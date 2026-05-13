# Overview

[← Wiki home](./README.md)

## What is UnDocker?

**UnDocker** is a web user interface for **Docker on [Unraid](https://unraid.net/)**. It is distributed as an **emhttp plugin**: a PHP shell page embeds a **React** single-page application (SPA) that talks to Unraid’s **GraphQL** API for almost all Docker operations, plus a small **PHP** script for **Compose file** read/write and `docker compose up -d`.

It is aimed at users who want:

- A **dense container table** (name, status, image, IP, ports, uptime, created, autostart, update hints).
- **Quick actions** (start/stop/restart/pause, delete, logs, update flow) without leaving the page.
- **Template-aware** behavior: Web UI links, Unraid template icons, **Edit** in the stock template editor, and **Shell** via Unraid’s terminal integration when available.
- A **Compose workspace** for YAML under safe host paths (`/mnt/user`, `/mnt/cache`, `/boot/config`, `/mnt/diskN`).

## What UnDocker is not

- **Not a replacement for Unraid’s entire Docker stack** — it does not reimplement CA, template repositories, or Unraid’s update scripts; it **calls** the same GraphQL mutations the stock UI relies on.
- **Not a separate authentication system** — access is whatever your Unraid web session allows.
- **Not a hosted SaaS** — everything runs on your NAS in the browser you already use for Unraid.

## Relationship to the stock Docker page

UnDocker complements Unraid’s built-in Docker UI:

- **Edit** opens the same style of URL as the stock flow (`/Docker/UpdateContainer?xmlTemplate=edit:…`).
- **Shell** uses `window.top.openTerminal` when the Unraid shell integration is present.
- **Update** and **logs** use dedicated windows so long operations do not block the main table.

You can keep using the stock Docker page for workflows UnDocker does not cover yet.

## Next steps

- [Requirements](./Requirements.md)
- [Installation](./Installation.md)
