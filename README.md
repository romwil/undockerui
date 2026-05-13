# UndockerUI

**UndockerUI** is an **improved Docker experience for [Unraid](https://unraid.net/)**—a plugin page that replaces the day-to-day limitations of Unraid’s **built-in Docker UI** with a faster, information-rich grid, clearer details, compose editing from the browser, and dedicated logs/update flows. It runs as an **emhttp** plugin: the SPA talks to Unraid’s **GraphQL API** for container lifecycle, logs, and autostart, and a small **PHP compose helper** edits `docker-compose.yml` on the server and runs `docker compose up -d` where needed.

**Repository:** [github.com/romwil/undockerui](https://github.com/romwil/undockerui)

---

## Features

| Area | What you get |
|------|----------------|
| **Container grid** | Name, status, image, IP, ports, uptime, created, autostart, update flags, actions |
| **Template icons** | Unraid / CA icons from `iconUrl` or Docker labels (`net.unraid.docker.icon`), with safe URL handling |
| **Row menu** | Open Web UI (`[IP]` → container IP), **Edit** (stock Unraid template editor), **Shell** (`openTerminal`), **Details**, **Compose workspace** — same underlying Docker engine as the stock page, clearer layout in UndockerUI |
| **Details pane** | Volume mappings, networks / LAN / ports, Compose labels, project / support / registry links |
| **Compose workspace** | Load YAML, browse allowed paths, **Save & deploy** / **Deploy** via `docker compose up -d` (server-side PHP + CSRF) |
| **Updates** | Opens a dedicated window with GraphQL `updateContainer` / `updateAllContainers` plus live polling |
| **Logs** | Dedicated window with tail selection and GraphQL log stream |
| **Refresh** | 30s polling + refetch on window focus for the container list |

---

## Requirements

- **Unraid** with Docker enabled (`DOCKER_ENABLED=yes` in `/boot/config/docker.cfg` — same condition as the stock Docker page).
- **Modern browser** (Chromium / Firefox / Safari current).
- Plugin files installed under **`/usr/local/emhttp/plugins/undockerui/`** (see [Installation](docs/INSTALLATION.md)).

---

## Quick install (manual)

1. On your dev machine, clone and build:

   ```bash
   git clone https://github.com/romwil/undockerui.git
   cd undockerui/web
   npm ci
   npm run build
   ```

   This writes **`plugin/dist/`** (including `compose_api.php` copied next to `index.html`).

2. Copy the **`plugin/`** tree to the server:

   ```text
   /usr/local/emhttp/plugins/undockerui/
     UndockerUI.page
     undockerui.php
     compose_api.php
     dist/
       index.html
       compose_api.php
       assets/
       …
   ```

3. Reload the Unraid web UI. Under **Main** (or your menu layout), open **UndockerUI** when Docker is enabled (same Docker engine as Unraid’s stock Docker page—UndockerUI is an alternate UI).

Full paths, permissions, and troubleshooting: **[docs/INSTALLATION.md](docs/INSTALLATION.md)** — or the **[wiki Installation chapter](https://github.com/romwil/undockerui/wiki/Installation)** for the expanded guide.

---

## Development

From repo root:

```bash
npm install --prefix web   # first time
npm run dev                # Vite dev server + proxies (see .env.example)
```

Or `cd web && npm ci && npm run dev`.

Details: **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.

---

## Documentation index

| Doc | Purpose |
|-----|---------|
| **[GitHub Wiki](https://github.com/romwil/undockerui/wiki)** | **Full wiki** — overview, requirements, install, first run, UI, compose, logs/updates, architecture, configuration, security, troubleshooting, development, FAQ |
| **[Unraid API and keys](https://github.com/romwil/undockerui/wiki/Unraid-API-and-keys)** | **Unraid:** enable GraphQL, Management Access, create API keys, use with `npm run dev` |
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Short install reference (see wiki for depth) |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Vite, env vars, GraphQL proxy, compose API |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, CSRF, path rules, hardening notes |
| [docs/GRAPHQL.md](docs/GRAPHQL.md) | Queries/mutations used and schema snapshot |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PRs, commits, scope |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Disclaimer

This plugin can **start, stop, remove, and update containers** and **run `docker compose`** on your NAS. It is an **alternate UI** to Unraid’s built-in Docker page (same engine). Use it only on systems you administer, keep Unraid updated, and protect the web GUI (strong passwords, VPN, or restricted access).
