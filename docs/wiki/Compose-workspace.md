# Compose workspace

[← Wiki home](./README.md)

## Purpose

The **Compose workspace** modal lets you:

- Point at a **`docker-compose.yml`** or **`docker-compose.yaml`** file on the server (under allowed roots).
- **Load** the current YAML from disk.
- **Deploy** (`docker compose … up -d`) without saving file changes first.
- **Save & deploy** — write YAML to disk, then run `docker compose … up -d`.

All file and compose operations go through **`compose_api.php`** with **CSRF** validation.

## Allowed paths

The server only accepts paths whose **resolved** directory stays under:

- `/mnt/user/`
- `/mnt/cache/`
- `/boot/config/`
- `/mnt/diskN/` (N numeric)

Symlinks that escape those roots are **rejected** after `realpath()`.

## Browse behavior

1. **Unraid file browser** — If `window.top.openFileBrowser` exists (stock Unraid Docker template UI), the plugin tries to open the native file picker bound to the path input.
2. **Server directory listing** — Otherwise the SPA calls **`listDir`** on `compose_api.php`, which returns directories and `*.yml` / `*.yaml` files for the current folder.

## API actions (reference)

POST JSON to **`/plugins/undockerui/dist/compose_api.php`** (same origin as the SPA) with:

| `action` | Required fields | Result |
|----------|-----------------|--------|
| `listDir` | `path` (directory) | `{ ok, path, entries: [{ name, path, type }] }` |
| `read` | `path` (compose file) | `{ ok, content, path }` |
| `composeUp` | `path` (existing compose file) | Runs `docker compose -f <file> up -d`, returns log + exit code |
| `writeApply` | `path`, `yaml` | Writes file, then same compose command |

Every request must include a valid **CSRF** token (body field `csrf` and/or `x-csrf-token` header) matching `/var/local/emhttp/var.ini`.

## Practical tips

- Prefer paths under **`/mnt/user/appdata/...`** for compose projects so they survive array upgrades and are easy to back up.
- After **Save & deploy**, read the **log** panel in the modal for `docker compose` stderr/stdout.
- If you see **“bad JSON”** or **404**, confirm **`plugin/dist/compose_api.php`** exists next to **`index.html`** (see [Installation](./Installation.md)).

## Next steps

- [Architecture](./Architecture.md) — how the SPA resolves `compose_api.php`
- [Security](./Security.md) — trust model for this endpoint
