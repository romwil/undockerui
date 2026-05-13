# Configuration

[← Wiki home](./README.md)

## Production (on Unraid)

Normally **no extra configuration** is required:

- The SPA calls **`/graphql`** on the **same origin** as the Unraid web UI.
- The compose API is resolved as **`./compose_api.php`** next to `index.html` under `/plugins/undockerui/dist/`.

### Optional: custom GraphQL URL at build time

If your GraphQL endpoint is not same-origin `/graphql`, rebuild with:

```bash
cd web
VITE_GRAPHQL_URL=https://your-host.example/graphql npm run build
```

This bakes the override into the static JS. Most Unraid installs do **not** need this.

---

## Local development

Environment variables are read from a **`.env` file in the repository root** (parent of `web/`), because `web/vite.config.ts` sets `envDir: '..'`.

Copy `.env.example` to `.env` in the **repo root**. Vite loads **`UNRAID_*`** keys in `vite.config.ts` only (not bundled into JS). **`VITE_GRAPHQL_URL`** is optional and only affects **production** builds.

| Variable | Role |
|----------|------|
| `UNRAID_IP` | Fallback host when full URLs are omitted. |
| `UNRAID_GRAPHQL` | Full GraphQL URL; overrides IP + port when set. |
| `UNRAID_GRAPHQL_PORT` | Used when `UNRAID_GRAPHQL` is empty (default `8081`). |
| `UNRAID_WEBGUI` | Web GUI origin for `compose_api.php` proxy (include port, e.g. `:80`). |
| `UNRAID_API_KEY` | Optional; dev proxy sends `x-api-key` on `/graphql`. |
| `UNRAID_KEY` | Legacy alias for `UNRAID_API_KEY`. |

In **dev**, the SPA always calls **`/graphql`** on the Vite host so those `UNRAID_*` values apply to the **proxy** only.

Dev server proxies (see `vite.config.ts`):

- `/graphql` → Unraid GraphQL (optional `x-api-key`).
- `/plugins/undockerui/dist/compose_api.php` (and alternate path) → `UNRAID_WEBGUI` origin.

Run:

```bash
npm run dev
```

from repo root (delegates to `web/`) or `cd web && npm run dev`.

---

## Unraid-side configuration

- **Docker** must be enabled for the menu item to appear.
- **User permissions** follow Unraid’s roles: users without Docker rights will see GraphQL permission errors.

## Next steps

- [Development](./Development.md)
- [Troubleshooting](./Troubleshooting.md)
