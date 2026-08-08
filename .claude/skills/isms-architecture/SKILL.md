---
name: isms-architecture
description: "Project map for this Inventory Stock Management System (ISMS) repo — models, controllers, routes, frontend pages, and the Shopee/GAS integration. Activate before exploring the codebase, adding features, fixing bugs, or answering 'where is X' questions, so the whole tree doesn't need re-reading. Covers Product/Variant/Order/OrderItem/SystemSetting models, IndexedShopee controller, Repository/Service/DTO layers, NativePHP desktop integration, and known tech debt."
metadata:
  type: project-map
  branch: develop
---

# ISMS Project Map

Snapshot of the `develop` branch. Business context: this app is a **cache/proxy layer in front of Google Apps Script (GAS) + Google Sheets**, which is the real source of truth for products and orders. Laravel/SQLite hold a local synced copy for fast lookups; GAS endpoints are hit for writes and periodic re-sync (see `SystemSetting::shopee_gas_version` version-check polling).

## Models (`app/Models`)

| Model | Table | PK | Purpose |
|---|---|---|---|
| `Product` | `products` | `product_id` (int, non-incrementing, from Google Sheet) | `hasMany(Variant, 'product_id', 'product_id')` |
| `Variant` | `variants` | `sku` (string) | `belongsTo(Product)`; `bundle` JSON column describes kit/bundle composition (`origin_sku`/`dummy_item`); scope `active()` |
| `Order` | `orders` | auto id | Local order cache; unique `tracking_number`/`order_sn`; `is_packed`/`packed_at`/`is_active`; scope `pendingPack()`; `hasMany(OrderItem)` |
| `OrderItem` | `order_items` | auto id | `belongsTo(Order)`; `sku, quantity, price` |
| `SystemSetting` | `system_settings` | `key` (string) | Key/value config (e.g. `shopee_gas_version`, `maintenance_mode`) |
| `User` | `users` | id | Standard auth; uses PHP 8.3 `#[Fillable]`/`#[Hidden]` attributes, not `$fillable`/`$hidden` |

Model PKs deliberately use natural/business keys (not auto-increment) to mirror the Google Sheets source of truth — follow this when adding related models.

## Controllers & Routes (`app/Http/Controllers`, `routes/web.php`, `routes/api.php`)

- **`IndexedShopee.php`** — current/preferred Shopee order controller (`shopee-api/*` in `routes/api.php`, names `shopee-query`, `shopee-setpacked`, `shopee-date-query`, `shopee-required-query`). Injects `ProductEnrichmentService`, `RequiredProductEnrichmentService`, `VersionCheckerService`. Has a `sqlite` vs `api` mode toggle (currently hardcoded to `'sqlite'` rather than going through `OrderRepositoryFactory`).
- **`ShopeeController.php`** — legacy/superseded duplicate of the above with hardcoded GAS URLs and inline enrichment. Prefer `IndexedShopee` for new work; don't extend this one.
- **`OrderUploadController.php`** — `POST /upload-orders` Excel import (`maatwebsite/excel`), sniffs Shopee vs TikTokShop sheet format, forwards to GAS. Also `GET /get-packing-orders`.
- **`ProductAdminController.php`** — admin product CRUD, proxied entirely to GAS, no local DB writes.
- **`ProductSyncController.php`** — `POST /api/sync-products`, re-seeds local `products`/`variants` from GAS via `Artisan::call('db:seed', ProductSeeder)`.
- **`SummaryController.php`** — `POST /getSummary`, parallel `Http::pool()` fetch of Shopee + TikTok daily summaries from GAS.
- **`SystemSettingController.php`** — `POST /admin/settings` via `SystemSettingService::set()`.
- **`ItemsBarcodeController.php`** — EAN-13 barcode generate/validate, pure utility.
- **`PlaygroundController.php`** — dev/scratch controller (`/pg*`), not business logic.
- **`SkuFetchTestController`** — referenced in `routes/web.php` (`/products/check`, `/api/products/check`) but not present under `app/Http/Controllers` as of last check — verify before relying on those routes.

Frontend routes render Inertia pages under `isms/*` (e.g. `isms/dashboard`, `isms/dashboardAdmin`). NativePHP desktop routes: `/api/select-directory`, `/api/save-video` (screen-recording/packing-verification feature, uses `Native\Desktop\Dialog`).

Wayfinder-generated TS mirrors of every controller/route live under `resources/js/actions/App/Http/Controllers/**` and `resources/js/routes/**` — prefer importing those over hand-writing fetch URLs.

## Shopee/GAS Integration Layers

Preferred layered pattern for anything touching GAS — follow this for new integration code instead of the inline style in `ShopeeController`/`ProductAdminController`:

```
Controller → Repository (OrderRepositoryInterface: SqliteOrderRepository / ApiOrderRepository, via OrderRepositoryFactory)
           → Service (ProductEnrichmentService, RequiredProductEnrichmentService, VersionCheckerService, SystemSettingService)
           → Normalizer (GasProductNormalizer)
           → DTO (app/DTOs/*.php — readonly classes, promoted ctor props)
```

- `app/DTOs/`: `RawProductData`, `RequiredProductData`, `OrderFetchResult`
- `app/Exceptions/OrderFetchException.php` — domain exception for fetch failures
- `database/seeders/ProductSeeder.php`, `OrderSeeder.php` — pull full snapshots from GAS
- `app/Console/Commands/MockShopeeData.php` (`artisan shopee:mock`), `MockPGData.php` (`shopee:mock1`) — GAS load/stress test generators
- GAS URLs belong in `config/services.php` / `.env` (`SHOPEE_SCRIPT_URL`, `PRODUCTS_SCRIPT_URL`, `TIKTOKSHOP_SCRIPT_URL`) — several older files hardcode them directly instead; don't copy that.

## Frontend (`resources/js`)

- `pages/isms/` — main app: `dashboard.tsx`, `dashboardAdmin.tsx`, `order.tsx`, `packing.tsx`, `product.tsx`, `ProductAddModal.tsx`, `ProductEditModal.tsx`.
- `pages/isms/components/` (aliased `@components/...`): `Preparation.tsx`, `ProductVerifyRow.tsx`, `ScannerStatusBar.tsx`, `ShopeePanel.tsx`, `ShopeeVerifyPage.tsx`, `stocks.tsx`, `system-settings.tsx`, `universalpack.tsx`, `universalpackscan.tsx`.
- `pages/pg/` — dev/playground pages, not production UI.
- `pages/welcome.tsx` — starter-kit default, effectively dead (shadowed by the `/` route closure in `routes/web.php`).
- No shared `resources/js/components/`, `layouts/`, or `hooks/` yet — everything currently lives inside `pages/isms/`.
- Stack extras beyond the standard kit: `lucide-react`, `sweetalert2`, `chart.js`/`react-chartjs-2`.
- Data fetching in `dashboard.tsx` currently uses plain `fetch()` rather than Wayfinder actions or `useForm`/`useHttp` — when touching that code, prefer migrating to Wayfinder per the `wayfinder-development` skill rather than adding more raw `fetch()` calls.

## Conventions

- Thai-language inline comments are an established team convention throughout controllers/services/seeders — keep them when editing nearby code.
- No Form Requests, Policies, or Enums exist yet anywhere in `app/` — validation is inline `$request->validate()` in controllers, no authorization layer. Match this unless the user asks to introduce one.
- `laravel/sanctum` is installed (`personal_access_tokens` table, Wayfinder stubs for `CsrfCookieController`) but not actively used — no `auth:sanctum` middleware or login/register controller exists.
- `nativephp/desktop` config: `app/Providers/NativeAppServiceProvider.php` (window title "Inventory stock manage system(Goodfriends Food)", 1280x800).

## Known Tech Debt (don't "fix" silently — flag/ask first)

- `routes/web.php` has both `Route::inertia('/', 'welcome')->name('home')` and a closure for `/` — the closure wins, `welcome.tsx`/`home` route are dead.
- `IndexedShopee` hardcodes `'sqlite'` mode instead of using `OrderRepositoryFactory`.
- `ShopeeController.php` duplicates `IndexedShopee` with hardcoded URLs — legacy, avoid extending.
- `app/Imports/UsersImport.php` is an unused stub.
- `SkuFetchTestController` referenced in routes but missing from `app/Http/Controllers` — verify before touching those routes.

## Where docs live

- `CLAUDE.md` is Boost-managed/auto-generated (framework version pins + generic conventions) — don't add project-specific notes there, they may be clobbered by `boost:update`. This file is the place for that instead.
- No `README.md` architecture docs, no `docs/` folder.
