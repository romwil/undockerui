# Development

[← Wiki home](./README.md)

## Clone and install

```bash
git clone https://github.com/romwil/undockerui.git
cd undockerui
npm install --prefix web
```

## Daily commands

From repo root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server + hot reload |
| `npm run build` | Typecheck + production bundle + copy `compose_api.php` |
| `npm run lint` | ESLint |

## Code map (`web/src/`)

| Area | Files (indicative) |
|------|-------------------|
| Main table & mutations | `App.tsx` |
| GraphQL documents & types | `lib/docker.ts` |
| GraphQL transport & CSRF | `lib/graphql.ts`, `lib/graphqlUrl.ts` |
| Safe URLs | `lib/safeUrl.ts` |
| Compose HTTP client | `composeApi.ts` |
| Compose modal | `ComposeWorkspaceModal.tsx` |
| Unraid URL helpers | `unraidLinks.ts`, `unraidFileBrowser.ts` |
| Logs / update child apps | `LogsWindowApp.tsx`, `UpdateProgressApp.tsx`, `logsUrl.ts`, `updateProgressUrl.ts` |

## Environment

See **[Configuration](./Configuration.md)** for the full `.env` reference. For **Unraid Management Access, GraphQL sandbox, and API keys**, see **[Unraid API and keys](./Unraid-API-and-keys.md)**.

## Tests / CI

GitHub Actions runs **`npm ci`**, **`npm run lint`**, and **`npm run build`** in `web/` on pushes and PRs to `main` / `master`.

## Contributing

See **`CONTRIBUTING.md`** in the repository root: keep PRs focused, run lint/build, use security advisories for sensitive bugs.

## Next steps

- [Configuration](./Configuration.md)
- [Architecture](./Architecture.md)
