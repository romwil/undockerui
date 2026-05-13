# Unraid API, GraphQL, and API keys

[← Wiki home](./README.md)

This page explains how to turn on Unraid’s **programmatic API** (GraphQL), **create and use API keys**, and how that relates to **local UnDocker development** (`npm run dev` with a repo-root `.env` file).

> **Official reference:** [Using the Unraid API](https://docs.unraid.net/API/how-to-use-the-api/) — treat Unraid’s docs as the source of truth if menus or version numbers change.

---

## Do you need an API key for UnDocker?

| How you use UnDocker | Typical auth |
|----------------------|--------------|
| **In the Unraid web UI** (plugin page, same browser session as Unraid) | Your normal **login session** + **CSRF** cookies. **No API key** required for day-to-day use. |
| **`npm run dev` on another computer** talking to Unraid’s GraphQL | Often a **session cookie is not available**, so Unraid may require an **API key** on GraphQL (see your Unraid version and **Management Access** settings). Set **`UNRAID_API_KEY`** in `.env` so the Vite dev proxy can send **`x-api-key`**. |

UnDocker’s production build (running **inside** Unraid) uses **`/graphql`** on the **same origin** as the web UI, like other Dynamix pages.

---

## 1. Unraid version and API availability

- **Unraid 7.2+** — GraphQL API is documented as built-in; follow **Settings → Management Access** paths below.
- **Older releases** — You may need **Unraid Connect** (or related components) from **Community Applications**; see [Welcome to Unraid API](https://docs.unraid.net/API/) for your OS version.

If **API Keys** or **Developer Options** do not appear, update Unraid or install the components your release requires.

---

## 2. Enable GraphQL access (sandbox / developer options)

Unraid exposes GraphQL at **`http(s)://YOUR_SERVER/graphql`** (often on the **GraphQL port**, frequently **8081**, while the main web UI may be **80** or **443** — your mileage may vary).

**Web GUI (recommended):**

1. Open the Unraid web UI as an **administrator**.
2. Go to **Settings → Management Access → Developer Options** (wording may vary slightly by version).
3. Enable the **GraphQL Sandbox** (or equivalent) option described in the [official “Enabling the GraphQL sandbox”](https://docs.unraid.net/API/how-to-use-the-api/#enabling-the-graphql-sandbox) section.
4. Confirm you can reach the endpoint from your LAN, e.g. `http://YOUR_SERVER_IP:8081/graphql` (adjust host/port to match your server).

**CLI (optional):**

```bash
unraid-api developer --sandbox true
```

See [Unraid API CLI](https://docs.unraid.net/API/cli/) for more.

---

## 3. Create an API key

**Web GUI (recommended):**

1. Go to **Settings → Management Access → API Keys**.
2. **Create** a new key with a clear name (e.g. `undocker-dev-laptop`).
3. Assign **roles / permissions** appropriate for Docker management. For development, follow the principle of **least privilege** that still allows the operations you need (Unraid documents roles such as admin / connect / guest in the API docs — Docker management typically needs sufficient scope; avoid sharing a full-admin key if you can use a tighter role on newer Unraid builds).
4. **Copy the key once** when shown; store it in a password manager. Unraid will not show the full secret again.

**CLI (optional):**

```bash
unraid-api apikey --create
```

Programmatic creation is documented under [Programmatic API key management](https://docs.unraid.net/API/programmatic-api-key-management/).

---

## 4. Use the key with HTTP clients (and UnDocker dev)

Unraid expects the key on GraphQL requests as an HTTP header:

```http
x-api-key: YOUR_API_KEY_HERE
```

UnDocker’s **Vite dev proxy** adds that header for you when you set in **repo-root** `.env`:

```env
UNRAID_API_KEY=paste-your-key-here
```

(Legacy alias: `UNRAID_KEY`.)

Then run `npm run dev` from the repo; the browser calls **`/graphql`** on the dev server, and Vite forwards to your **`UNRAID_GRAPHQL`** target with **`x-api-key`** attached. See [Configuration](./Configuration.md) and [Using the Unraid API](https://docs.unraid.net/API/how-to-use-the-api/#using-api-keys).

---

## 5. Network and firewall checklist (remote dev)

For a laptop on your LAN (or VPN) running `npm run dev`:

| Check | Why |
|-------|-----|
| **GraphQL port reachable** | Often **8081** from the dev machine to the Unraid IP (TCP). |
| **Web GUI origin for compose proxy** | **`UNRAID_WEBGUI`** in `.env` must match how you open Unraid in a browser (scheme + host + **port**). |
| **Management Access / “extra” security** | If Unraid blocks remote API access, allow your dev client IP or use VPN into the same LAN as Unraid. |
| **HTTPS / certificates** | If the web UI is HTTPS-only, use `https://` in `UNRAID_WEBGUI` / `UNRAID_GRAPHQL` as appropriate. |

---

## 6. Security practices

- **Rotate** keys if they leak or when developers leave the team.
- **Revoke** unused keys under **Settings → Management Access → API Keys**.
- **Do not commit** `.env` or keys to git (this repo’s `.gitignore` excludes `.env`).
- Prefer **VPN** to Unraid over exposing the GraphQL port to the public internet.
- Unraid’s API may apply **rate limiting**; see [official error handling](https://docs.unraid.net/API/how-to-use-the-api/#error-handling-and-rate-limiting).

---

## 7. Explore the schema (optional)

- [Apollo GraphQL Studio — Unraid API](https://studio.apollographql.com/graph/Unraid-API/variant/current/home) — schema explorer.
- Local **sandbox** URL after enabling developer options (see Unraid docs).

---

## Related UnDocker docs

- [Configuration](./Configuration.md) — `.env` variables (`UNRAID_GRAPHQL`, `UNRAID_WEBGUI`, `UNRAID_API_KEY`).
- [Troubleshooting](./Troubleshooting.md) — dev proxy and 401/403 issues.
