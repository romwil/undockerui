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

Copy `.env.example` to `.env` and adjust:

| Variable | Role |
|----------|------|
| `UNRAID_IP` | Default host for constructed GraphQL / web URLs. |
| `UNRAID_GRAPHQL` | Full GraphQL URL for the dev proxy target. |
| `UNRAID_GRAPHQL_PORT` | Used when `UNRAID_GRAPHQL` is unset (default `8081`). |
| `UNRAID_WEBGUI` | Origin used as the **target** for proxied `compose_api.php` requests. |
| `UNRAID_KEY` | Optional: dev proxy adds `x-api-key` for Unraid setups that require it. |

Dev server proxies (see `vite.config.ts`):

- `/graphql` → your Unraid GraphQL origin.
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
