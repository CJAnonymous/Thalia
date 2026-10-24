<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'thalia_grocery';
const DB_USER = 'root';
const DB_PASS = '';

function storeDatabase(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $server = new PDO(
        'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $server->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

    $connection = new PDO(
        'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $connection->exec("CREATE TABLE IF NOT EXISTS store_meta (
        meta_key VARCHAR(64) PRIMARY KEY,
        meta_value VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $connection->exec("CREATE TABLE IF NOT EXISTS store_products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        sku VARCHAR(100) NOT NULL DEFAULT '',
        category VARCHAR(120) NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        stock INT UNSIGNED NOT NULL DEFAULT 0,
        unit VARCHAR(40) NOT NULL DEFAULT 'pc',
        INDEX idx_products_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $connection->exec("CREATE TABLE IF NOT EXISTS store_sales (
        id VARCHAR(64) PRIMARY KEY,
        sale_id VARCHAR(64) NULL,
        product_id VARCHAR(64) NULL,
        product_name VARCHAR(200) NOT NULL,
        customer_name VARCHAR(200) NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        total DECIMAL(12,2) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'sale',
        occurred_at DATETIME(3) NOT NULL,
            payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
            amount_received DECIMAL(12,2) NOT NULL DEFAULT 0,
            change_due DECIMAL(12,2) NOT NULL DEFAULT 0,
        INDEX idx_sales_date (occurred_at),
        INDEX idx_sales_type (type),
        INDEX idx_sales_receipt (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $saleIdColumn = $connection->query("SHOW COLUMNS FROM store_sales LIKE 'sale_id'")->fetch();
    if (!$saleIdColumn) {
        $connection->exec('ALTER TABLE store_sales ADD COLUMN sale_id VARCHAR(64) NULL AFTER id');
    }
    $saleIdIndex = $connection->query("SHOW INDEX FROM store_sales WHERE Key_name = 'idx_sales_receipt'")->fetch();
    if (!$saleIdIndex) {
        $connection->exec('ALTER TABLE store_sales ADD INDEX idx_sales_receipt (sale_id)');
    }
    foreach ([
        'payment_method' => "VARCHAR(20) NOT NULL DEFAULT 'cash'",
        'amount_received' => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
        'change_due' => 'DECIMAL(12,2) NOT NULL DEFAULT 0',
    ] as $column => $definition) {
        $columnExists = $connection->query("SHOW COLUMNS FROM store_sales LIKE '" . $column . "'")->fetch();
        if (!$columnExists) {
            $connection->exec('ALTER TABLE store_sales ADD COLUMN ' . $column . ' ' . $definition);
        }
    }
    $connection->exec("UPDATE store_sales SET sale_id = id WHERE type = 'sale' AND sale_id IS NULL");
    $connection->exec("CREATE TABLE IF NOT EXISTS store_debts (
        id VARCHAR(64) PRIMARY KEY,
        customer VARCHAR(200) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        paid DECIMAL(12,2) NOT NULL DEFAULT 0,
        note TEXT NOT NULL,
        updated_at DATETIME(3) NOT NULL,
        last_charge_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        last_charge_date DATE NULL,
        INDEX idx_debts_customer (customer)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    return $connection;
}