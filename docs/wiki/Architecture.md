# Architecture

[← Wiki home](./README.md)

## High-level diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    Unraid web browser                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Unraid Dynamix shell (PHP, session, CSRF cookie)     │    │
│  │  ┌───────────────────────────────────────────────┐   │    │
│  │  │ iframe: /plugins/undockerui/dist/index.html   │   │    │
│  │  │         React SPA (TanStack Query + fetch)    │   │    │
│  │  └───────────────┬───────────────────────────────┘   │    │
│  └──────────────────┼────────────────────────────────────┘    │
└─────────────────────┼────────────────────────────────────────┘
                      │ same origin
          ┌───────────┴───────────┐
          ▼                       ▼
   POST /graphql           POST …/dist/compose_api.php
   (Unraid GraphQL)        (plugin PHP: YAML + docker compose)
```

## Front end (`web/`)

| Piece | Role |
|-------|------|
| **Vite + React 19** | UI rendering, code splitting, production bundle to `plugin/dist/`. |
| **TanStack Query** | Caching, mutations, refetch interval + window focus for the main container query. |
| **`graphqlRequest`** | `fetch` to `/graphql` with JSON body, `credentials: 'include'`, `x-csrf-token`. |
| **`composeApiRequest`** | `fetch` to `./compose_api.php` relative to the SPA URL; sends CSRF in header + body. |
| **Multi-entry** | `main.tsx` switches between main app, logs-only, and update-progress-only bundles via `?view=` query params. |

## Plugin PHP

| File | Role |
|------|------|
| **`UnDocker.page`** | emhttp menu registration + `include` of `undockerui.php`. |
| **`undockerui.php`** | Layout + iframe `src` with CSRF query parameter. |
| **`compose_api.php`** | Validates CSRF, validates paths with `realpath`, `read` / `write` / `listDir` / `exec` compose only. |

## Data sources

- **GraphQL** — Authoritative for container list, state, ports, labels, logs, autostart table, remove/start/stop/pause/update mutations. Schema varies by Unraid version; see repo `docs/graphql-schema.snapshot.graphql` (non-binding snapshot).
- **Docker labels** — Used client-side for compose metadata, template icons, and Web UI hints when GraphQL fields are empty.

## Build pipeline

```text
npm run build  (in web/)
  → tsc -b
  → vite build  → ../plugin/dist/assets/*
  → cp ../plugin/compose_api.php ../plugin/dist/compose_api.php
```

`plugin/dist/` is **gitignored**; releases ship built assets or consumers run the build locally.

## Next steps

- [Configuration](./Configuration.md)
- [Development](./Development.md)
