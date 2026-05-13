# Installation

[← Wiki home](./README.md)

## Summary

1. Build the SPA on a machine with **Node.js** (produces `plugin/dist/`).
2. Copy the **`plugin/`** directory to **`/usr/local/emhttp/plugins/undockerui/`** on the Unraid server.
3. Reload the Unraid web UI and open **UnDocker** from the menu.

---

## Step 1 — Build the front end

From a checkout of [romwil/undockerui](https://github.com/romwil/undockerui):

```bash
cd undockerui/web
npm ci
npm run build
```

What this does:

- Runs **TypeScript** (`tsc -b`) and **Vite** production build.
- Writes static assets to **`../plugin/dist/`** (relative to `web/`).
- Copies **`../plugin/compose_api.php`** to **`../plugin/dist/compose_api.php`** so the browser can POST to `./compose_api.php` next to `index.html`.

> **Important:** `plugin/dist/` is listed in `.gitignore`. You **must** run `npm run build` after every pull that changes the UI or `compose_api.php`, then redeploy the `dist/` folder to the server.

---

## Step 2 — Deploy on Unraid

Copy (rsync, SMB, flash backup, etc.) so the server has:

```text
/usr/local/emhttp/plugins/undockerui/
  UnDocker.page          # Registers the menu item under Tasks (see file for Menu= index)
  undockerui.php         # Wrapper: iframe → /plugins/undockerui/dist/index.html?csrf=…
  compose_api.php        # Optional duplicate; the served copy for the SPA is under dist/
  dist/
    index.html
    compose_api.php      # Required: same directory as index.html
    assets/              # Hashed JS/CSS from Vite
    favicon.svg
    icons.svg
```

### Permissions

Match other Dynamix plugins: typically **644** for files, **755** for directories, owned so **emhttp** can read them. If assets 404 after an SMB copy, re-check execute bits on directories.

### `UnDocker.page`

This file tells Unraid where to show the plugin and when:

- **`Cond=`** — only if Docker is enabled (same idea as the stock Docker page).
- **`include`** — loads `undockerui.php` from the path above.

If you change the install path, update the `include()` path in `UnDocker.page` accordingly (non-standard installs only).

---

## Step 3 — Verify

1. Log into the Unraid web UI.
2. Open **UnDocker** (default: under **Tasks** in the menu; position is controlled by `Menu="Tasks:61"` in `UnDocker.page`).
3. You should see the container table load without errors.
4. Optional: open **Compose workspace**, choose **Browse** — you should get a JSON directory listing or the Unraid file browser, not an HTML 404 page.

---

## Upgrading

1. Pull latest sources (or download a release archive when available).
2. `cd web && npm ci && npm run build`.
3. Overwrite **`/usr/local/emhttp/plugins/undockerui/dist/`** and any updated **`undockerui.php`**, **`UnDocker.page`**, or root **`compose_api.php`**.
4. Hard-refresh the browser (Ctrl+Shift+R) to avoid stale cached JS.

---

## Uninstall

Remove the directory:

```bash
rm -rf /usr/local/emhttp/plugins/undockerui
```

Then remove or hide **UnDocker** from the Unraid menu if your Unraid version caches menu entries (reboot or reload emhttp per Unraid docs).

---

## Related

- [First run](./First-run.md)
- [Troubleshooting](./Troubleshooting.md)
- [Architecture](./Architecture.md) — why `compose_api.php` lives in `dist/`
