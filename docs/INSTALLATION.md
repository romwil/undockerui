# Installing UnDocker on Unraid

UnDocker is a **static SPA** (`plugin/dist/`) plus **PHP** entrypoints served by Unraid’s **emhttp** web server. There is no separate Docker container for the UI itself.

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
  UnDocker.page          # Menu registration (Tasks submenu)
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

`UnDocker.page` registers the plugin when **Docker is enabled**:

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
2. Open **UnDocker** from the menu (under **Tasks** by default — see `Menu="Tasks:61"` in `UnDocker.page`).
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
