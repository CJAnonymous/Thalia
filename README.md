# Thalia Grocery

## Run with XAMPP

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/Thalia%20Store/` in your browser.
3. On first launch, the app creates the `thalia_grocery` database and its tables. If the app was previously used in this same browser, its saved store data is imported once.

The default database connection in `config.php` uses the standard XAMPP `root` account with no password. Update `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASS` there if your MySQL setup uses different credentials.

## Point of sale

Open **Point of sale** from the main navigation. Search or filter the product catalog, select items to add them to the cart, and use the quantity controls to adjust the order. For cash, enter the amount received or use a quick-cash button; the screen calculates the change before checkout. For credit, choose **Utang**, enter the customer's name, and complete the sale to add the total to their ledger balance. Completed cash sales show a printable receipt.

## Back up the database

`backup.sql` is a point-in-time export of the database schema and records. To refresh it after making more changes, run this from PowerShell:

```powershell
C:\xampp\mysql\bin\mysqldump.exe -u root --databases thalia_grocery --add-drop-database --routines --triggers --events --single-transaction --result-file="C:\xampp\htdocs\Thalia Store\backup.sql"
```

To restore it, open `http://localhost/phpmyadmin/` and use **Import** to select `backup.sql`. This export includes `--add-drop-database`, so importing it replaces the current `thalia_grocery` database with the snapshot. Changes made after the export are not in the backup.

The app is intended for a local store workstation and does not include user accounts or access controls.