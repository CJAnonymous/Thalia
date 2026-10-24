<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function requestBody(): array
{
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        respond(['error' => 'Request body must be a JSON object.'], 400);
    }
    return $body;
}

function sqlDateTime(mixed $value): string
{
    $date = new DateTimeImmutable((string) $value);
    return $date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
}

function isoDateTime(string $value): string
{
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d\TH:i:s.v\Z');
}

function currentStoreState(PDO $db): array
{
    $products = $db->query('SELECT id, name, sku, category, price, stock, unit FROM store_products ORDER BY name')->fetchAll();
    $sales = $db->query('SELECT id, sale_id, product_id, product_name, customer_name, quantity, total, type, occurred_at, payment_method, amount_received, change_due FROM store_sales ORDER BY occurred_at')->fetchAll();
    $debts = $db->query('SELECT id, customer, amount, paid, note, updated_at, last_charge_amount, last_charge_date FROM store_debts ORDER BY customer')->fetchAll();

    return [
        'products' => array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'name' => $row['name'],
            'sku' => $row['sku'],
            'category' => $row['category'],
            'price' => (float) $row['price'],
            'stock' => (int) $row['stock'],
            'unit' => $row['unit'],
        ], $products),
        'sales' => array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'saleId' => $row['sale_id'],
            'productId' => $row['product_id'],
            'productName' => $row['product_name'],
            'customer' => $row['customer_name'],
            'qty' => (int) $row['quantity'],
            'total' => (float) $row['total'],
            'type' => $row['type'],
            'date' => isoDateTime($row['occurred_at']),
            'paymentMethod' => $row['payment_method'],
            'amountReceived' => (float) $row['amount_received'],
            'changeDue' => (float) $row['change_due'],
        ], $sales),
        'debts' => array_map(static fn (array $row): array => [
            'id' => $row['id'],
            'customer' => $row['customer'],
            'amount' => (float) $row['amount'],
            'paid' => (float) $row['paid'],
            'note' => $row['note'],
            'updated' => isoDateTime($row['updated_at']),
            'lastChargeAmount' => (float) $row['last_charge_amount'],
            'lastChargeDate' => $row['last_charge_date'],
        ], $debts),
    ];
}

function replaceStoreState(PDO $db, array $state): void
{
    foreach (['products', 'sales', 'debts'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) {
            throw new InvalidArgumentException('Store data is missing a valid ' . $key . ' list.');
        }
    }

    $db->exec('DELETE FROM store_sales');
    $db->exec('DELETE FROM store_debts');
    $db->exec('DELETE FROM store_products');

    $productInsert = $db->prepare('INSERT INTO store_products (id, name, sku, category, price, stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($state['products'] as $product) {
        $productInsert->execute([
            (string) ($product['id'] ?? ''),
            (string) ($product['name'] ?? ''),
            (string) ($product['sku'] ?? ''),
            (string) ($product['category'] ?? ''),
            (float) ($product['price'] ?? 0),
            max(0, (int) ($product['stock'] ?? 0)),
            (string) ($product['unit'] ?? 'pc'),
        ]);
    }

    $salesInsert = $db->prepare('INSERT INTO store_sales (id, sale_id, product_id, product_name, customer_name, quantity, total, type, occurred_at, payment_method, amount_received, change_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($state['sales'] as $sale) {
        $salesInsert->execute([
            (string) ($sale['id'] ?? ''),
            isset($sale['saleId']) ? (string) $sale['saleId'] : (($sale['type'] ?? 'sale') === 'sale' ? (string) ($sale['id'] ?? '') : null),
            isset($sale['productId']) ? (string) $sale['productId'] : null,
            (string) ($sale['productName'] ?? 'Store sale'),
            isset($sale['customer']) ? (string) $sale['customer'] : null,
            max(0, (int) ($sale['qty'] ?? 1)),
            (float) ($sale['total'] ?? 0),
            (string) ($sale['type'] ?? 'sale'),
            sqlDateTime($sale['date'] ?? 'now'),
            (string) ($sale['paymentMethod'] ?? 'cash'),
            (float) ($sale['amountReceived'] ?? 0),
            (float) ($sale['changeDue'] ?? 0),
        ]);
    }

    $debtInsert = $db->prepare('INSERT INTO store_debts (id, customer, amount, paid, note, updated_at, last_charge_amount, last_charge_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($state['debts'] as $debt) {
        $debtInsert->execute([
            (string) ($debt['id'] ?? ''),
            (string) ($debt['customer'] ?? ''),
            (float) ($debt['amount'] ?? 0),
            (float) ($debt['paid'] ?? 0),
            (string) ($debt['note'] ?? ''),
            sqlDateTime($debt['updated'] ?? 'now'),
            (float) ($debt['lastChargeAmount'] ?? 0),
            $debt['lastChargeDate'] ?? null,
        ]);
    }
}

try {
    $db = storeDatabase();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = $_GET['action'] ?? '';

    if ($method === 'GET') {
        $initialized = $db->query("SELECT meta_value FROM store_meta WHERE meta_key = 'initialized'")->fetchColumn() === '1';
        respond(['initialized' => $initialized, 'state' => $initialized ? currentStoreState($db) : null]);
    }

    if ($method === 'POST' && $action === 'bootstrap') {
        $incoming = requestBody();
        $db->exec("INSERT IGNORE INTO store_meta (meta_key, meta_value) VALUES ('initialized', '0')");
        $db->beginTransaction();
        $status = $db->query("SELECT meta_value FROM store_meta WHERE meta_key = 'initialized' FOR UPDATE")->fetchColumn();
        if ($status !== '1') {
            replaceStoreState($db, $incoming);
            $db->exec("UPDATE store_meta SET meta_value = '1' WHERE meta_key = 'initialized'");
        }
        $db->commit();
        respond(['initialized' => true, 'state' => currentStoreState($db)]);
    }

    if ($method === 'PUT' && $action === '') {
        $incoming = requestBody();
        $db->beginTransaction();
        $status = $db->query("SELECT meta_value FROM store_meta WHERE meta_key = 'initialized' FOR UPDATE")->fetchColumn();
        if ($status !== '1') {
            $db->rollBack();
            respond(['error' => 'The store database has not been initialized. Reload the page to set it up.'], 409);
        }
        replaceStoreState($db, $incoming);
        $db->commit();
        respond(['saved' => true]);
    }

    header('Allow: GET, POST, PUT');
    respond(['error' => 'Unsupported API request.'], 405);
} catch (Throwable $error) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('Thalia Grocery API: ' . $error->getMessage());
    respond(['error' => 'Could not save store data. Check that MySQL is running and the database settings in config.php are correct.'], 500);
}