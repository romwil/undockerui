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

Copy **`.env.example`** to **`.env`** in the **repository root** (parent of `web/`). Vite loads env from `envDir: '..'` in `web/vite.config.ts`.

| Variable | Purpose |
|----------|---------|
| `UNRAID_IP` | Target Unraid host for dev proxies |
| `UNRAID_GRAPHQL` | Full GraphQL URL (default constructed from IP + port) |
| `UNRAID_GRAPHQL_PORT` | Port if `UNRAID_GRAPHQL` is omitted (default `8081`) |
| `UNRAID_WEBGUI` | Origin for `compose_api.php` proxy target |
| `UNRAID_KEY` | Optional **dev-only** `x-api-key` header for GraphQL proxy (Unraid Connect / API key setups) |

Never commit `.env`.

## Production GraphQL URL

In production builds, the SPA defaults to **`/graphql`** on the same origin as the Unraid web UI. Override at build time with:

```bash
VITE_GRAPHQL_URL=https://your-unraid.example/graphql npm run build
```

Only set this if your GraphQL endpoint is not same-origin `/graphql`.

## Proxies (dev)

`web/vite.config.ts` proxies:

- `/graphql` → Unraid GraphQL (optional `UNRAID_KEY` header)
- `/plugins/undockerui/dist/compose_api.php` and `/plugins/undockerui/compose_api.php` → Unraid web GUI origin

So local dev expects your Unraid box to accept connections from the dev machine (firewall rules, correct IP in `.env`).

## TypeScript

Project references `web/tsconfig.app.json` and `web/tsconfig.node.json`. Run `npx tsc -b` via `npm run build`.
