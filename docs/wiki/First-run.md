# First run

[← Wiki home](./README.md)

## Opening UnDocker

1. Sign in to the **Unraid web UI** as you normally do.
2. Find **UnDocker** in the menu. By default it appears under **Tasks** (see `Menu="Tasks:61"` in `UnDocker.page`).
3. If the menu item is **missing**, Docker may be disabled: check **Settings → Docker** and `/boot/config/docker.cfg` for `DOCKER_ENABLED=yes`.

## What you see first

- A **header** with search, filters (updates-only, compose-only), and global actions (e.g. update-all flow).
- A **table** of containers with columns documented in [Using the UI](./Using-the-UI.md).
- Data loads via **`POST /graphql`** with your session cookies and **`x-csrf-token`** header (and optional `?csrf=` on the iframe URL for the same token).

## CSRF and session

UnDocker relies on Unraid’s **CSRF token** like other Dynamix pages:

- The iframe is loaded with `?csrf=…` from `undockerui.php`.
- The SPA also reads the token from the query string, optional global `csrf_token`, or non-HttpOnly cookie patterns implemented in `web/src/lib/graphql.ts`.

If API calls return **403** or GraphQL auth errors, confirm you are still logged in and that the system clock is sane.

## Performance expectations

- The main list **refetches every 30 seconds** and on **window focus** so the grid stays reasonably fresh without hammering the server.
- Large numbers of containers (hundreds) may make the initial GraphQL response slower; use search and filters to narrow the view.

## Next steps

- [Using the UI](./Using-the-UI.md)
- [Troubleshooting](./Troubleshooting.md) if anything fails on first load
