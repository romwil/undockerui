# Development

## Layout

```text
undockerui/
  package.json           # Convenience scripts → web/
  web/                   # Vite + React + TypeScript SPA
    src/
    vite.config.ts
  plugin/
    UnDocker.page        # emhttp menu
    undockerui.php       # iframe host page
    compose_api.php      # Copied into dist/ on each build
    dist/                # Build output (gitignored — run npm run build)
```

## Prerequisites

- **Node.js 20+** (CI uses 22)
- npm 10+

## Commands

From repository root:

| Command | Effect |
|---------|--------|
| `npm run dev` | Start Vite dev server (`web/`) |
| `npm run build` | Production build → `plugin/dist/` |
| `npm run lint` | ESLint in `web/` |

From `web/`, the same scripts exist directly.

## Environment variables

Copy **`.env.example`** to **`.env`** in the **repository root** (parent of `web/`). `web/vite.config.ts` sets `envDir: '..'` so Vite reads that file when you run `npm run dev` / `npm run build` from `web/`.

### `UNRAID_*` (vite config only — not bundled into the SPA)

`vite.config.ts` uses `loadEnv(..., 'UNRAID_')`, so **only** variables whose names start with `UNRAID_` are read from `.env` for server-side config. They control **dev-server proxies** and are never sent to the browser as literals.

| Variable | Purpose |
|----------|---------|
| `UNRAID_IP` | Fallback host if you omit full URLs (default `127.0.0.1`). |
| `UNRAID_GRAPHQL` | **Full** GraphQL URL (`http(s)://host:port/graphql`). If set, it wins over `UNRAID_IP` + `UNRAID_GRAPHQL_PORT`. |
| `UNRAID_GRAPHQL_PORT` | Used only when `UNRAID_GRAPHQL` is empty; combined with `UNRAID_IP` as `http://IP:PORT/graphql` (default port `8081`). |
| `UNRAID_WEBGUI` | **Web GUI origin** (`http(s)://host:port`) for proxying `compose_api.php`. Include the port you use in the browser (e.g. `:80` or `:443`). If unset, defaults to `http://UNRAID_IP`. |
| `UNRAID_API_KEY` | Optional. If set, dev proxy adds **`x-api-key`** on proxied `POST /graphql` (Unraid Connect / API key auth). |
| `UNRAID_KEY` | Legacy alias for `UNRAID_API_KEY`. |

Never commit `.env`.

### `VITE_*` (embedded in the client bundle)

Only **`VITE_GRAPHQL_URL`** is used by the app today, and **only in production builds** (`graphqlHttpUrl()` in dev always returns `/graphql` so traffic stays on the Vite proxy).

## Production GraphQL URL

In production builds, the SPA defaults to **`/graphql`** on the same origin as the Unraid web UI. Override at build time with:

```bash
cd web
VITE_GRAPHQL_URL=https://your-unraid.example/graphql npm run build
```

Only set this if the browser cannot use same-origin `/graphql`.

## Proxies (dev)

`web/vite.config.ts` proxies:

- **`/graphql`** → target from `UNRAID_GRAPHQL` or `http://UNRAID_IP:UNRAID_GRAPHQL_PORT/graphql` (optional **`x-api-key`** from `UNRAID_API_KEY` or `UNRAID_KEY`).
- **`/plugins/undockerui/dist/compose_api.php`** and **`/plugins/undockerui/compose_api.php`** → `UNRAID_WEBGUI` origin.

Your dev machine must reach those Unraid ports (firewall / LAN / VPN).

## TypeScript

Project references `web/tsconfig.app.json` and `web/tsconfig.node.json`. Run `npx tsc -b` via `npm run build`.
