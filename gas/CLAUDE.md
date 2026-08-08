# Google Apps Script backends (source of truth)

Three GAS web apps back this app. Laravel/SQLite is a synced cache in front of them — see project root `.claude/skills/isms-architecture`. Pulled locally with `clasp clone` for reading/editing; push back with `clasp push` from inside each subfolder after `clasp login`.

- `shopee/` — script id `1uHkwcnZawoS9l-ujcsgUfeUbL1b6qu_9fSJXySazFdMXGuz05iUU4vx9`, deployed at `.env` `SHOPEE_SCRIPT_URL`. Backs orders (`Order`/`OrderItem` models, `IndexedShopee` controller).
- `products/` — script id `1DuII0zdrG6nxtd6Bbwc6t6YTWCivjVqymB_84JncneSy6Eq1591yi6nx`, deployed at `.env` `PRODUCTS_SCRIPT_URL`. Backs `Product`/`Variant` models. Bound to spreadsheet `1oLI-lw2pDaMuo5B8lXEicIzcZycI7nDWmyjwy7s6P1U` (hardcoded `SHEET_ID` in `รหัส.js`, not passed via config).
- `stock/` — not yet deployed/pulled with clasp (created by hand, `SHEET_ID` placeholder in `รหัส.js` needs filling in and a real Sheet before `clasp create`/`clasp push`). Deployed URL goes in `.env` `STOCK_SCRIPT_URL`. Backs the Stocks admin page (`resources/js/pages/isms/components/stocks.tsx`, proxied via `StockController`) and the stock-decrement hook in `IndexedShopee::setpacked`. Keyed by `barcode` (not linked to `Variant`/`Product` tables in Laravel — matched by barcode string only). Sheet `Stocks`: `barcode, product_name, count, updated_at`.
- `appsscript.json` in each: `webapp.access: ANYONE_ANONYMOUS`, `executeAs: USER_DEPLOYING` — no auth on either endpoint, security relies on URL secrecy.
- TikTokShop GAS not pulled yet (out of scope for now).

## shopee/รหัส.js

Bound to a "ShopeeDB" spreadsheet with two sheets:

- **Master** (`tracking_number, order_sn, product_info_sku(JSON), TimeStamp, IsPacked, PackedAt, IsActive, YearMonth`) — append-only order log, `YearMonth` stored as text (leading `'`) for partition-style filtering.
- **Index** (`tracking_number, row_index, YearMonth, order_sn`) — maps tracking number to its Master row number, rebuilt via `rebuildIndex()`/`handleRebuildIndex`. `loadIndex()` also builds an in-memory `_orderSnMap` for order_sn lookups with multiple trackings.

`doPost` routes on `action`:

| action | handler | purpose |
|---|---|---|
| `insert` | `handleInsert` | batch-insert rows, dedup by tracking_number, under `LockService` |
| `pack` | `handlePack` | mark `IsPacked=1`, idempotent |
| `deactivate` | `handleDeactivate` | soft-delete (`IsActive=0`) |
| `query` | `handleQuery` | all active rows for a `yearMonth` |
| `query_daily` | `handleQueryDaily` | active rows for a `date` (YYYY-MM-DD) |
| `query_daily_summary` | `handleQueryDailySummary` | `{total, packed}` counts for a date |
| `query_sku_summary` | `handleQuerySkuSummary` | per-SKU packed/unpacked/total, filterable by date or yearMonth |
| `query_unpacked` | `handleQueryUnpacked` | all active + not-yet-packed rows |
| `query_single` | `handleQuerySingleOptimized` | lookup by tracking_number or order_sn via `TextFinder` |
| `rebuild_index` | `handleRebuildIndex` | rebuild Index sheet from Master |

Writes (`insert`/`pack`/`deactivate`/`rebuild_index`) wrap in `LockService.getScriptLock()` (10s timeout). Reads batch-fetch a single `getRange().getValues()` chunk spanning min/max target row rather than per-row calls, to stay under GAS quota.

Dead code: `handleQuerySingle` (older non-optimized version, superseded by `handleQuerySingleOptimized` but still present and unused by `doPost`'s switch). `debugIndexAndQuery`/`clearIndexCache` are manual-run dev utilities, not part of the API surface.

## products/รหัส.js

Bound (via `SpreadsheetApp.openById(SHEET_ID)`, not container-bound) to sheets `Products` (`product_id, product_name, is_active`), `Variants` (`sku, product_id, variant_name, barcode, is_active, bundle(JSON)`), `meta` (cell A1 = integer version counter, bumped on every write — matches `SystemSetting::shopee_gas_version` polling on the Laravel side).

`doGet`: only `?action=version` → returns raw meta version as plain text (`getVersion`).

`doPost` routes on `action`:

| action | handler | purpose |
|---|---|---|
| `productsinfolists` | `handleproductsinfolists` | full dump of Products+Variants rows, auto-creates missing sheets with headers |
| `get_products_joined` | `getAllProductsJoined` | Products joined with their active Variants, nested per product |
| `edit_product_full` | `handleEditProductFull` | update product name + upsert variants by `original_sku`/`sku`; also rewrites `bundle` JSON on *other* variants that reference a renamed SKU (`type: 'origin_sku'`) |
| `add_product_full` | `handleAddProductFull` | create product (auto-increment `product_id` = max existing + 1) + its variants |

Every write handler bumps `meta!A1` by 1 and returns `new_version`. No `LockService` here (unlike shopee script) — concurrent writes are not guarded.

## stock/รหัส.js

Bound (via `SpreadsheetApp.openById(SHEET_ID)`) to a `Stocks` sheet: `barcode, product_name, count, updated_at`, auto-created with headers on first access if missing. Row lookup is a linear scan matched by `barcode` (`findStockRow_`), no Index sheet like `shopee/`.

`doGet`: `?action=get-stocks` → dump all rows as `{success, data: [{barcode, productName, count}]}`.

`doPost` routes on `action`:

| action | handler | purpose |
|---|---|---|
| `add-stock` | `handleAddStock` | insert new row, rejects duplicate `barcode` |
| `edit-stock` | `handleEditStock` | update `product_name`/`count` for an existing `barcode` |
| `decrement-stock` | `handleDecrementStock` | `{barcode, quantity}` → `count = max(0, count - quantity)`; called server-to-server from `IndexedShopee::setpacked`, not from the frontend. Unknown barcode returns `{success:false, error:'not_found'}` rather than an HTTP error, so the pack flow doesn't break. |

All writes wrap in `LockService.getScriptLock()` (10s timeout), matching `shopee/`.
