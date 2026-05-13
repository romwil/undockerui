# Security

UnDocker runs **inside the authenticated Unraid web UI** and inherits the same session and CSRF model as other Dynamix pages. Treat the combination of **this UI + Unraid GraphQL + compose API** as **full administrative access** to Docker and selected filesystem paths on the NAS.

## Threat model

| Trust boundary | Notes |
|----------------|--------|
| **Unraid login** | Anyone who can load the plugin page can perform actions exposed in the UI (same as stock Docker pages). |
| **CSRF** | GraphQL uses `x-csrf-token`. `compose_api.php` validates the server-side CSRF token from `/var/local/emhttp/var.ini` (body `csrf` or `x-csrf-token`). |
| **Cross-site** | Malicious sites cannot read your session cookies on Unraid’s origin; keep Unraid on HTTPS in untrusted networks. |

## compose API (`plugin/dist/compose_api.php`)

- **POST only**, JSON body, CSRF required.
- Paths restricted to **`/mnt/user/`**, **`/mnt/cache/`**, **`/boot/config/`**, and **`/mnt/diskN/`** after **`realpath()`** resolution (mitigates symlink escapes).
- **`exec`** is limited to `docker compose -f <file> up -d` with `escapeshellarg` on directory and filename.
- **No separate RBAC** beyond “can reach this PHP as a logged-in Unraid user.”

## Front-end hardening

- **Links** (Web UI, project, support, registry): `javascript:`, `data:`, and protocol-relative `//` URLs are rejected before use in `href`.
- **Template icons**: image `src` values are sanitized similarly after path normalization.
- **Edit container URL**: `templatePath` is restricted to plausible Unraid paths (`/boot/config/…`, `/mnt/user/…`, `/mnt/diskN/…`).
- **Shell menu**: shell argument is allowlisted; container names with obvious shell metacharacters are rejected before calling `openTerminal`.
- **`postMessage`**: the main app only accepts messages from **`window.location.origin`**.

## CSRF in the iframe URL

`undockerui.php` passes the CSRF token in the iframe query string so the SPA can read it when the cookie is not readable from JavaScript. That can leak via **`Referer`** on external navigations. Mitigations: use **HTTPS**, add **`Referrer-Policy`** at the web server for `/plugins/undockerui/`, and avoid logging full query strings.

## Reporting issues

Use [GitHub Security Advisories](https://github.com/romwil/undockerui/security/advisories/new) for sensitive reports. For general bugs, use [Issues](https://github.com/romwil/undockerui/issues).
