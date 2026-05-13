# Troubleshooting

[← Wiki home](./README.md)

## Menu item missing

| Check | Action |
|-------|--------|
| Docker disabled | Enable Docker in Unraid; confirm `DOCKER_ENABLED=yes` in `/boot/config/docker.cfg`. |
| Files not installed | Verify `/usr/local/emhttp/plugins/undockerui/UnDocker.page` exists and `include` path matches `undockerui.php` location. |
| Stale menu | Reload nginx/emhttp or reboot per Unraid documentation. |

---

## Blank iframe or white page

| Check | Action |
|-------|--------|
| 404 on `index.html` | Confirm `plugin/dist/index.html` exists at `/usr/local/emhttp/plugins/undockerui/dist/index.html`. |
| JS errors | Open browser devtools **Console** on the Unraid page; fix 404s for `/plugins/undockerui/dist/assets/*.js`. |
| Wrong `base` | Rebuild with this repo’s Vite config (`base: '/plugins/undockerui/dist/'`). |

---

## GraphQL errors

| Symptom | Likely cause |
|---------|----------------|
| HTTP 401/403 | Session expired or insufficient user permissions for Docker. |
| Field errors after Unraid upgrade | GraphQL schema changed; update the SPA queries in `web/src/lib/docker.ts` to match your version. |
| Connection refused (dev) | `UNRAID_IP` / `UNRAID_GRAPHQL` wrong; firewall blocking port **8081** (or your custom GraphQL port). |

---

## Compose API: “bad JSON” or HTTP 404

| Symptom | Likely cause |
|---------|----------------|
| HTML 404 body | **`compose_api.php` is not** next to **`index.html`** in `dist/`. Run `npm run build` (it copies PHP into `dist/`). |
| 403 Invalid CSRF | Token mismatch: reload Unraid page to refresh session; ensure cookies are not stripped. |
| Invalid path | Path outside allowed roots or symlink escape blocked by server validation. |

---

## Icons show the generic Docker glyph

| Check |
|-------|
| Container has no Unraid template icon label and no `iconUrl` from GraphQL. |
| Icon URL blocked by sanitization (unsafe scheme). |
| Image URL wrong for browser (fixed for `/usr/local/emhttp/…` style paths in normal cases). |

---

## Shell menu does nothing

UnDocker calls **`window.top.openTerminal`**. That exists only when the SPA runs **inside** the full Unraid UI with stock JS loaded. Open UnDocker from the Unraid menu, not as a raw file or isolated origin.

---

## Logs window says missing `id`

Open logs from the **Logs** button in the main table so the URL includes the container id query parameter.

---

## Still stuck?

1. Note **Unraid version**, **browser**, and **redacted** console/network errors.
2. Open a [GitHub Issue](https://github.com/romwil/undockerui/issues) (no secrets in screenshots).

## Related

- [Installation](./Installation.md)
- [Configuration](./Configuration.md)
