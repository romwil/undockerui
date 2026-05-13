# Logs and updates

[← Wiki home](./README.md)

## Logs window

**Logs** opens a **separate browser window** (or tab) on the same Unraid origin with query parameters:

- `view=logs`
- `id` — GraphQL container id (prefixed id from Unraid’s API)
- `name` — Display label for the window title
- `tail` — Number of log lines (bounded in the UI)

That window runs a slim **Logs** SPA which repeatedly queries **`UndockerContainerLogs`** via GraphQL. You can change **tail** (100–2500) and **Refresh** without closing the window.

**Why a new window?** Long-running log tails stay usable while you navigate the main UnDocker table.

## Update progress window

**Update** (single container) or **Update all** opens another dedicated window:

- `view=update` plus either `id` + `name` (single) or `mode=all`.
- Runs the GraphQL mutation **`updateContainer`** or **`updateAllContainers`**.
- **Polls** a lightweight container list on an interval and appends human-readable diff lines to a scrollable log.
- On completion, notifies the **opener** with `postMessage` (same origin) so the main table can **invalidate** its React Query cache, and uses a **BroadcastChannel** to signal “remote update running” for UI disabling.

**Expect long runtimes** — image pulls and Unraid’s update scripts can take many minutes; leave the window open until it reports completion.

## CSRF in child windows

Log/update URLs optionally append `csrf=` from the parent page’s query string so the child window can authenticate GraphQL the same way as the iframe parent.

## Next steps

- [Troubleshooting](./Troubleshooting.md)
- [Security](./Security.md) — `postMessage` origin checks
