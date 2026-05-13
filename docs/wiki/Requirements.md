# Requirements

[← Wiki home](./README.md)

## Unraid

- A supported **Unraid** installation with **Docker enabled**.
- The menu entry is shown only when Docker is enabled, matching Unraid’s check on `DOCKER_ENABLED=yes` in `/boot/config/docker.cfg` (see `UnDocker.page` in the plugin).

## Browser

- A **current** Chromium-, Firefox-, or Safari-based browser with JavaScript enabled.
- Third-party cookie blockers rarely affect same-origin Unraid; if the table never loads, check the browser console for blocked `fetch` to `/graphql`.

## Network

- For **normal use**, you only access UnDocker through your **Unraid web GUI** URL (LAN or VPN). No extra ports are opened by UnDocker itself.
- For **local development** against a remote Unraid box, your dev machine must reach Unraid’s GraphQL port (often **8081**) and the web GUI port; see [Configuration](./Configuration.md).

## Disk and permissions

- **Install location:** plugin files under `/usr/local/emhttp/plugins/undockerui/` (see [Installation](./Installation.md)).
- **Compose workspace** can read/write Compose files only under:
  - `/mnt/user/`
  - `/mnt/cache/`
  - `/boot/config/`
  - `/mnt/diskN/` (numeric disk shares)

## Knowledge

- Basic familiarity with **Unraid** (Docker tab, templates, shares).
- Optional: **Docker Compose v2** syntax if you use the Compose workspace.

## Next steps

- [Installation](./Installation.md)
- [First run](./First-run.md)
