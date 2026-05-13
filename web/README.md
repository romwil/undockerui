# UnDocker — web UI (Vite + React)

This directory is the **UnDocker front-end**: a React 19 SPA that talks to Unraid’s GraphQL API and to `compose_api.php` on the same origin.

## Commands

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server (proxies configured in `vite.config.ts` + root `.env`) |
| `npm run build` | Typecheck + production bundle → `../plugin/dist/` + copy `compose_api.php` |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

## Documentation

Project-wide docs live in the **[repository root README](../README.md)** and **[docs/](../docs/)**.
