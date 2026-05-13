# Installing UndockerUI on Unraid

**UndockerUI** is an **improved Docker UI for Unraid** compared to the built-in Docker page. Technically it is a **static SPA** (`plugin/dist/`) plus **PHP** entrypoints served by Unraid’s **emhttp** web server. There is no separate Docker container for the UI itself.

## Upgrade from older installs

If you previously copied **`UnDocker.page`**, delete it from **`/usr/local/emhttp/plugins/undockerui/`** and install **`UndockerUI.page`** instead so the menu shows a single **UndockerUI** entry (same plugin path; the filename controls the `/UndockerUI` route).

## 1. Build on a machine with Node.js

```bash
git clone https://github.com/romwil/undockerui.git
cd undockerui/web
npm ci
npm run build
```

The build:

- Runs TypeScript + Vite and outputs to **`../plugin/dist/`**
- Copies **`../plugin/compose_api.php`** into **`../plugin/dist/compose_api.php`** so the browser can POST to the same directory as `index.html`

## 2. Install paths on the Unraid server

Copy the **`plugin/`** directory so the server has:

```text
/usr/local/emhttp/plugins/undockerui/
  UndockerUI.page        # Menu registration (Tasks submenu)
  undockerui.php         # Wrapper + iframe
  compose_api.php        # Source copy (optional on server; dist/ has the served one)
  dist/
    index.html
    compose_api.php      # Must exist next to index.html for compose API URL resolution
    assets/
    favicon.svg
    icons.svg
```

### Permissions

Files should be readable by **nobody** / **emhttp** like other Dynamix plugins (typically `644` for files, `755` for directories). If you use SMB to copy from Windows, confirm execute bits on folders if something fails to load.

## 3. Menu entry

`UndockerUI.page` registers the plugin when **Docker is enabled**:

```text
Cond="exec(\"grep -o '^DOCKER_ENABLED=.yes' /boot/config/docker.cfg 2>/dev/null\")"
```

After install, **hard-refresh** the browser (Ctrl+Shift+R) or restart **emhttp** if the menu does not appear:

```bash
/etc/rc.d/rc.nginx reload
# or from Unraid: Settings → Management Access → reload web UI as documented for your version
```

## 4. Verify

1. Log into the Unraid web UI.
2. Open **UndockerUI** from the menu (under **Tasks** by default — see `Menu="Tasks:61"` in `UndockerUI.page`). It appears alongside Unraid’s stock Docker tools and uses the same Docker engine.
3. You should see the container table. Opening **Compose workspace** and listing a directory should return JSON (not HTML 404).

## Troubleshooting

| Symptom | Check |
|--------|--------|
| Blank iframe | Browser console for 404 on `/plugins/undockerui/dist/index.html` |
| Compose API “bad JSON” / 404 | `plugin/dist/compose_api.php` exists and is reachable at the same path depth as `index.html` |
| GraphQL errors | Unraid version supports the `docker { … }` schema; user must be allowed to manage Docker |
| No menu item | `DOCKER_ENABLED=yes` in `/boot/config/docker.cfg` |

## Community Applications (optional)

To publish via **CA**, package the built `plugin/` tree according to Unraid plugin packaging rules (separate from this repo’s source layout). The maintainer may add a CA template later; manual install above always works.
