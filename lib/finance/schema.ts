import type { DatabaseSync } from 'node:sqlite';

export function initializeFinance(db:DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_imports (
      id INTEGER PRIMARY KEY, checksum TEXT NOT NULL UNIQUE, source_name TEXT NOT NULL,
      imported_at TEXT NOT NULL, summary_json TEXT NOT NULL, workbook_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('asset','debt')), sort_order INTEGER NOT NULL,
      turnover_month INTEGER CHECK(turnover_month BETWEEN 1 AND 12)
    );
    CREATE TABLE IF NOT EXISTS finance_months (
      month TEXT PRIMARY KEY, as_of TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('excel','manual')),
      source_import_id INTEGER REFERENCES finance_imports(id), excel_total_minor INTEGER,
      note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_balances (
      month TEXT NOT NULL REFERENCES finance_months(month), account_id TEXT NOT NULL REFERENCES finance_accounts(id),
      amount_minor INTEGER NOT NULL, turnover INTEGER NOT NULL DEFAULT 0 CHECK(turnover IN (0,1)), source_cell TEXT,
      PRIMARY KEY(month,account_id)
    );
    CREATE TABLE IF NOT EXISTS finance_annual (
      as_of TEXT PRIMARY KEY, start_date TEXT, excel_total_minor INTEGER NOT NULL,
      nominal REAL, inflation REAL, excel_real REAL
    );
    CREATE TABLE IF NOT EXISTS finance_audit (
      id INTEGER PRIMARY KEY, month TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
      before_json TEXT, after_json TEXT NOT NULL, occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_lego_items (
      id TEXT PRIMARY KEY, set_number TEXT NOT NULL, name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 9999),
      unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor >= 0), acquired_on TEXT,
      revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS finance_lego_audit (
      id INTEGER PRIMARY KEY, item_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
      before_json TEXT, after_json TEXT NOT NULL, occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS finance_lego_imports (
      checksum TEXT PRIMARY KEY, imported_at TEXT NOT NULL, item_count INTEGER NOT NULL
    );
  `);
}
