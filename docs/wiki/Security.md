# Security

[← Wiki home](./README.md)

> For the canonical security document in the main repo, see **`docs/SECURITY.md`**. This wiki page summarizes the same ideas in prose.

## Trust boundary

Anyone who can **use the Unraid web UI with permission to manage Docker** can perform the actions exposed in UnDocker. There is **no separate UnDocker password**.

Treat UnDocker + Unraid GraphQL + `compose_api.php` as **full admin capability** over:

- Container lifecycle and images.
- Files under allowed compose paths (read/write + `docker compose up -d` output as the `emhttp` user).

## CSRF

- **GraphQL** requests send **`x-csrf-token`** (read from query, cookie patterns, or global as implemented in the SPA).
- **`compose_api.php`** compares the submitted token to **`csrf_token`** in `/var/local/emhttp/var.ini` using **`hash_equals`**.

## `compose_api.php` controls

- **POST only**, JSON body.
- **Path allowlist** + **`realpath()`** to prevent symlink escapes outside `/mnt/user`, `/mnt/cache`, `/boot/config`, `/mnt/diskN`.
- **`exec`** only for `docker compose -f <file> up -d` with **`escapeshellarg`** on directory and filename.

## Front-end hardening

- **Links** (`href`) and **icon `src`** are sanitized to block `javascript:`, `data:`, and protocol-relative `//` abuse from malicious template metadata.
- **Template edit URLs** only allow plausible Unraid filesystem prefixes.
- **`postMessage`** handlers validate **`event.origin`** against `window.location.origin`.

## CSRF in the iframe URL

`undockerui.php` embeds the CSRF token in the iframe **query string** so the SPA can read it when cookies are HttpOnly. That pattern can leak the token via **`Referer`** on navigations to third-party sites. Mitigations: HTTPS, strict **Referrer-Policy** on your reverse proxy, and avoiding external links from inside the SPA where possible.

## Reporting

Use [GitHub Security Advisories](https://github.com/romwil/undockerui/security/advisories/new) for sensitive reports.

## Next steps

- [Troubleshooting](./Troubleshooting.md)
