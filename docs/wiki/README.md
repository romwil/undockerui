# UnDocker Wiki

Welcome to the **UnDocker** documentation wiki: how the project fits into Unraid, how to install it, and how to use every part of the UI.

**Repository:** [romwil/undockerui](https://github.com/romwil/undockerui)

---

## Start here

| If you want to… | Read |
|-----------------|------|
| Understand what UnDocker is and why it exists | [Overview](./Overview.md) |
| Know hardware/software requirements | [Requirements](./Requirements.md) |
| Install or upgrade the plugin on Unraid | [Installation](./Installation.md) |
| Open the app and orient yourself | [First run](./First-run.md) |
| Use the table, filters, menus, and details | [Using the UI](./Using-the-UI.md) |
| Work with Compose files from the browser | [Compose workspace](./Compose-workspace.md) |
| Use logs windows and container image updates | [Logs and updates](./Logs-and-updates.md) |
| See how the pieces connect (SPA, GraphQL, PHP) | [Architecture](./Architecture.md) |
| Obtain Unraid API keys & enable GraphQL | **[Unraid API and keys](./Unraid-API-and-keys.md)** |
| Tune dev environment or `.env` | [Configuration](./Configuration.md) |
| Understand trust boundaries and reporting issues | [Security](./Security.md) |
| Fix common problems | [Troubleshooting](./Troubleshooting.md) |
| Quick questions | [FAQ](./FAQ.md) |
| Build from source or contribute | [Development](./Development.md) |

---

## Insights (design choices)

- **Same session as Unraid** — UnDocker is not a separate login; it uses your Unraid browser session and CSRF token, like the stock Docker page.
- **GraphQL for Docker** — Container list, lifecycle, logs, autostart, and image updates go through Unraid’s official GraphQL API so behavior stays aligned with the OS.
- **PHP only for Compose file I/O** — Reading/writing YAML and running `docker compose up -d` use a small `compose_api.php` endpoint with strict path rules and CSRF, because those operations are not exposed the same way through GraphQL in typical setups.
- **Iframe on purpose** — The plugin page loads the SPA in an iframe so the bundle can live under `/plugins/undockerui/dist/` while still inheriting cookies and same-origin access to `/graphql` and the compose API.
- **Icons from Docker labels** — When GraphQL does not return `iconUrl`, UnDocker reads `net.unraid.docker.icon` / `org.unraid.docker.icon` from container labels (same source as Unraid’s Docker client).
- **Unraid API keys are for dev / automation** — The plugin on the NAS uses your normal login session. API keys and **Settings → Management Access** options matter when you develop from another machine; see [Unraid API and keys](./Unraid-API-and-keys.md).

## Publishing this wiki on GitHub

GitHub’s **Wiki** tab uses a separate git repo (`*.wiki.git`). To mirror these pages there:

1. Clone `https://github.com/romwil/undockerui.wiki.git` (create an empty wiki in the repo **Settings → Features → Wiki** first).
2. Copy the `.md` files from `docs/wiki/` into the wiki clone (rename `README.md` to `Home.md` if you want GitHub’s default wiki landing page).
3. Push the wiki repo.

Until then, browse this folder in the main repository: **`docs/wiki/`**.
