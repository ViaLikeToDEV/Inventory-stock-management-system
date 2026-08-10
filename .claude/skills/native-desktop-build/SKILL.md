---
name: native-desktop-build
description: "Build Windows .exe installers for this app via NativePHP/Electron (php artisan native:build). Covers the two separate role-specific builds — Packers and Admin — env vars to swap per build, the config-cache gotcha for runtime env() reads, and why nativephp/ is gitignored and rebuilt from scratch each time instead of committed. Activate whenever asked to build/package/ship the desktop app, create an installer, or add a new native build variant."
metadata:
  type: workflow
  branch: develop
---

# Native Desktop Build (NativePHP + Electron)

## Why this exists

`nativephp/desktop` is installed (composer.json), but the generated Electron project + build output (`/nativephp` at repo root) is **gitignored on purpose** — it's ~100MB+ per build, regenerates from `vendor/nativephp/desktop`'s bundled Electron project every time, and running/watching it locally eats noticeably more CPU/RAM than plain `composer run dev`. Don't try to "fix" this by committing it or by publishing the Electron project (`--publish`) unless explicitly asked. Build on demand after a feature batch is done, not continuously.

## Two build targets, one codebase

The app ships as two separate installers that coexist side by side on a machine (different `app_id`, different install folder, different Start Menu entry):

| Target | Opens to | Nav (via `resources/js/pages/isms/*.tsx`) |
|---|---|---|
| **Packers** | `/` → `isms/dashboard` | Order, Packing, UniversalPack |
| **Admin** | `/admin/dashboard` → `isms/dashboardAdmin` | Product, Preparation, Stocks |

Controlled by `config('nativephp.build_target')` (`config/nativephp.php`, sourced from `NATIVEPHP_BUILD_TARGET` env, default `packer`), read in `app/Providers/NativeAppServiceProvider.php`:

```php
$isAdminBuild = config('nativephp.build_target') === 'admin';

Window::open('main')
    ->title($isAdminBuild ? '...- Admin (Goodfriends Food)' : '...- Packers (Goodfriends Food)')
    ->url($isAdminBuild ? url('/admin/dashboard') : url('/'))
    ...
```

**Must use `config()`, not raw `env()`, for this flag.** The packaged app runs `optimize`/`config:cache` on first boot; after that, raw `env()` calls stop reading `.env` and return `null`, silently falling back to the Packers branch regardless of what the bundled `.env` says. `config()` reads the cached array correctly. This bit us once — don't reintroduce it.

**`->url()` needs a full URL, not a route path.** `Window::url()` just does `$this->url = $url` — no resolution. Pass `url('/admin/dashboard')`, not `'/admin/dashboard'`. A bare path loads nothing and the window renders permanently blank/white (no error logged anywhere — looks exactly like a hang).

## Build steps (repeat per target)

1. **Edit `.env`** — swap these keys for the target you're building. Everything else stays as-is:

   ```
   # Packers
   APP_NAME="ISMS - Packers"
   NATIVEPHP_APP_ID=com.goodfriendsfood.isms.packer
   NATIVEPHP_APP_DESCRIPTION="Inventory Stock Management System - Packers build for Goodfriends Food"
   NATIVEPHP_BUILD_TARGET=packer

   # Admin
   APP_NAME="ISMS - Admin"
   NATIVEPHP_APP_ID=com.goodfriendsfood.isms.admin
   NATIVEPHP_APP_DESCRIPTION="Inventory Stock Management System - Admin build for Goodfriends Food"
   NATIVEPHP_BUILD_TARGET=admin
   ```

   Distinct `APP_NAME`/`app_id` per target is required — same id would make the second install overwrite/collide with the first (same userData folder, same Start Menu entry).

2. `php artisan config:clear` — clears the *local dev* config cache so the values above actually get read into the build.

3. `php artisan native:build win x64 --no-interaction` — runs `npm ci` in the Electron project, packages the PHP binary + app bundle, produces the NSIS installer. Takes a few minutes; run it via a backgroundable shell command, don't block on it synchronously.

4. Output lands at `nativephp/electron/dist/<APP_NAME>-<version>-setup.exe`. Move it out before building the next target — `native:build` reuses the same `dist/` folder and target N+1 doesn't clean up target N's exe:

   ```
   mkdir -p nativephp/electron/dist-releases
   mv "nativephp/electron/dist/<name>-setup.exe"* nativephp/electron/dist-releases/
   ```

5. After both targets are built, **restore `.env`** to the neutral baseline (`APP_NAME="Inventory Stock Management System"`, `NATIVEPHP_APP_ID=com.goodfriendsfood.isms`, no `NATIVEPHP_BUILD_TARGET` line) and `php artisan config:clear` again, so local `composer run dev` isn't left branded as one of the two targets.

## Testing a build before calling it done

Don't trust "build succeeded, exit 0" alone — a broken build can still produce a working-looking .exe that opens to a blank white window with zero errors logged. Always install and launch:

```
Start-Process -FilePath "nativephp/electron/dist-releases/<name>-setup.exe"
```

Then wait for the app process (name = `Str::slug(APP_NAME)`, e.g. `isms-packers.exe`) to appear, and **give it 20-40s on first launch** — first run does `migrate`/`optimize` against a fresh sqlite db in `%APPDATA%/<slug>/database`, which is slow. A blank/no window in the first 10-15s is normal; only worry if it's still blank after ~40s.

To confirm visually (Electron windows don't always show in a naive screen-region screenshot if another window is on top — use `SetForegroundWindow` via a small P/Invoke snippet first, matched on a **specific** title substring, not just "Inventory" or "Admin" — the VS Code window title contains "[Administrator]" and will false-match "Admin").

Check logs at `%APPDATA%\<app-slug>\storage\logs\laravel-*.log` for anything unexpected — empty/absent log after a launch is a good sign (no exceptions), not a bad one.

## Known gotchas already hit once

- **Duplicate route names break `route:cache`.** Production builds run `optimize` (includes `route:cache`) on first boot; dev mode never caches routes so a duplicate `->name(...)` across two routes goes unnoticed until packaged. If a packaged app never shows a window and the log has `LogicException: ... Another route has already been assigned name [...]`, that's the cause — fix the duplicate in `routes/api.php` or `routes/web.php`.
- **Icons**: `public/icon.ico` must be at least 256x256 or `electron-builder` refuses to build (`⨯ image ... must be at least 256x256`). Current icons are a low-res placeholder upscaled from `apple-touch-icon.png` — replace with real 512x512 art in `public/icon.png` + `public/icon.ico` when better assets exist; `InstallsAppIcon` trait picks them up automatically, no code change needed.
- **Code signing / SmartScreen**: intentionally skipped (internal staff tool, one-time click-through acceptable). `NATIVEPHP_UPDATER_ENABLED=false` also intentional — no update provider configured.
