# Using the UI

[← Wiki home](./README.md)

## Container table — columns

| Column | Meaning |
|--------|---------|
| **Name** | Primary container name (from Docker). Opens the **row menu** when clicked. Shows **Orphan** / **Compose** badges when applicable. |
| **Status** | Running / exited / paused (and transient lifecycle states during operations). |
| **Image** | Image reference string from Docker. |
| **IP** | Primary container IP from Docker network settings (first useful `IPAddress`). |
| **Ports** | Published / template port summary. |
| **Uptime** | Derived from Docker status text when available. |
| **Created** | Human-readable age from container created timestamp. |
| **Auto start** | Toggle for Unraid autostart entries (GraphQL mutation). |
| **Updates** | Repository update / rebuild hints when Unraid exposes them. |
| **Actions** | Start, stop, restart, pause, resume, update (opens progress window), delete, logs. |

## Row menu (click container name)

| Item | Behavior |
|------|----------|
| **Open Web UI** | Shown when the template exposes a Web UI URL. `[IP]` placeholders are replaced with the container’s Docker IP. Only **http(s)** and safe same-origin paths are used as `href`. |
| **Edit…** | Navigates the **top** window to Unraid’s **`/Docker/UpdateContainer`** with `xmlTemplate=edit:…` when a template path exists (not for pure compose orphans). |
| **> Shell** | When the container is **running**, calls Unraid’s **`openTerminal`** on `window.top` with the container name and a **sanitized** shell (default `bash`). Requires running inside the Unraid UI. |
| **Details** | Expands a **details pane** below the row. |
| **Compose workspace…** | Opens the modal for the selected compose project when compose labels are present (see [Compose workspace](./Compose-workspace.md)). |

## Details pane

When expanded, the row shows:

- **Volume mappings** — host → container paths (read-only display + copy).
- **Networks, LAN & ports** — per-network IPs, `lanIpPorts` from Unraid when present, and port mapping text.
- **Docker Compose** — Parsed `com.docker.compose.*` labels (project, service, config files, working dir).
- **Links** — Project / Support / Registry URLs from template metadata (**sanitized** before use).

## Filters and search

- **Search** — Substring match across name, image, status, IP, ports, uptime, age, and compose metadata.
- **Updates only** — Narrows to containers with a pending update signal.
- **Compose only** — Shows containers that carry Docker Compose v2 labels (`com.docker.compose.project`, etc.).

## Template icons

Icons come from, in order:

1. GraphQL **`iconUrl`** when present.
2. Docker labels **`net.unraid.docker.icon`** or **`org.unraid.docker.icon`**.
3. Font Awesome / `icon-*` class strings when the value is not a URL/path.
4. Otherwise a **generic Docker-style** fallback glyph.

Image URLs are normalized (e.g. `/usr/local/emhttp/…` → web path) and **sanitized** to block `javascript:` and protocol-relative `//` tricks.

## Global actions (header)

Typical patterns include:

- **Update all** — Opens the **update progress** window (see [Logs and updates](./Logs-and-updates.md)).
- **Compose workspace** — Can be opened from the header when wired in the build you use.

Exact buttons may evolve; always read tooltips in the UI for the current behavior.

## Next steps

- [Compose workspace](./Compose-workspace.md)
- [Logs and updates](./Logs-and-updates.md)
