# UnDocker

A **Docker-focused web UI for [Unraid](https://unraid.net/)** that runs as an emhttp plugin page. It talks to Unraid’s **GraphQL API** for container lifecycle, logs, and autostart, and ships a small **PHP compose helper** for editing `docker-compose.yml` files on the server.

**Repository:** [github.com/romwil/undockerui](https://github.com/romwil/undockerui)

---

## Features

| Area | What you get |
|------|----------------|
| **Container grid** | Name, status, image, IP, ports, uptime, created, autostart, update flags, actions |
| **Template icons** | Unraid / CA icons from `iconUrl` or Docker labels (`net.unraid.docker.icon`), with safe URL handling |
| **Row menu** | Open Web UI (`[IP]` → container IP), **Edit** (stock Unraid template editor), **Shell** (`openTerminal`), **Details**, **Compose workspace** |
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
     UnDocker.page
     undockerui.php
     compose_api.php
     dist/
       index.html
       compose_api.php
       assets/
       …
   ```

3. Reload the Unraid web UI. Under **Main** (or your menu layout), open **UnDocker** when Docker is enabled.

Full paths, permissions, and troubleshooting: **[docs/INSTALLATION.md](docs/INSTALLATION.md)**.

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
| [docs/INSTALLATION.md](docs/INSTALLATION.md) | Where files go on Unraid, build output, menu entry |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Vite, env vars, GraphQL proxy, compose API |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, CSRF, path rules, hardening notes |
| [docs/GRAPHQL.md](docs/GRAPHQL.md) | Queries/mutations used and schema snapshot |
| [CONTRIBUTING.md](CONTRIBUTING.md) | PRs, commits, scope |

---

## License

MIT — see [LICENSE](LICENSE).

---

## Disclaimer

This plugin can **start, stop, remove, and update containers** and **run `docker compose`** on your NAS. Use it only on systems you administer, keep Unraid updated, and protect the web GUI (strong passwords, VPN, or restricted access).
