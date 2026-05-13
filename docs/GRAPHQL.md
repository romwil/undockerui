# GraphQL usage

UnDocker uses Unraid’s **GraphQL HTTP endpoint** (typically **`POST /graphql`** on the web GUI origin, or port **8081** in some setups).

## Operations (SPA)

Defined in `web/src/lib/docker.ts`:

| Operation | Type | Purpose |
|-----------|------|---------|
| `UndockerContainers` | query | Full container list + update statuses |
| `UndockerPollContainers` | query | Lightweight poll during updates |
| `UndockerContainerLogs` | query | Log lines + cursor |
| `UndockerRemoveContainer` | mutation | Remove container (+ optional image) |
| `UndockerAutostart` | mutation | Autostart table |
| `UndockerStart` / `Stop` / `Pause` / `Unpause` | mutations | Lifecycle |
| `UndockerUpdateContainer` / `UndockerUpdateAll` | mutations | Image updates |

The exact schema **depends on your Unraid version**. A **non-authoritative snapshot** is committed for developer orientation only:

- **[graphql-schema.snapshot.graphql](graphql-schema.snapshot.graphql)**

If a field disappears or renames after an Unraid upgrade, update the queries in `docker.ts` and adjust types accordingly.

## Permissions

Unraid enforces permission checks server-side (e.g. Docker management). The SPA sends credentials (`fetch` with `credentials: 'include'`) and the CSRF header.

## Compose API (not GraphQL)

YAML read/write and `docker compose up -d` go through **`compose_api.php`** (see [SECURITY.md](SECURITY.md)).
