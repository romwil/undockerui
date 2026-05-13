# Vault 1848 / Hand of Franklin — feature roadmap

Prioritized ideas derived from the bundled Unraid **`schema.graphql`** (Query / Mutation surface) and the current Citizen + Overseer UI. Use this as a planning backlog; scope and permissions must match your API key roles.

**UX / layout / mobile:** see **`docs/ROADMAP_UX.md`**.

---

## Done recently (context)

- Telemetry heartbeat, storage matrix, Docker list + power actions, GNR relay, lore tickers, `logFile` / `logFiles` for container logs when `docker.logs` is absent.
- Chyron layout (local clock); Citizen and Overseer use the same speed **range** but separate saved preferences per page.

---

## Phase A — Read-only depth (low risk)

| Feature | GraphQL / API | UI idea |
|--------|----------------|---------|
| **Parity check history** | `parityHistory` | Small table or sparkline in telemetry: date, duration, result. |
| **Single disk detail** | `disk(id:)`, `disks` | Modal or side panel: transport, `numReads`/`numWrites`/`numErrors`, `fsSize`/`fsFree`/`fsUsed` when present. |
| **VM detail strip** | `vms` (expand fields) | State, vCPUs, memory if exposed; link to Unraid VM tab. |
| **Plugins panel** | `plugins` | Beyond count: versions, “has update” if in schema, link to CA. |
| **Log browser** | `logFiles`, `logFile` | Searchable list + tail viewer (reuse LOG plumbing). |
| **UPS deep view** | `upsDevices`, `upsDeviceById`, `upsConfiguration` | Runtime + config summary in telemetry. |
| **Network snapshot** | `network` | Interfaces summary (read-only). |
| **Services / Connect** | `services`, `connect`, `remoteAccess` | Status chips: WAN, dynamic DNS, remote access. |
| **Multi-server** | `servers`, `server` | If you use multiple nodes: selector + aggregated health. |
| **Public theme hook** | `publicTheme`, `customization` | Optional: accent color sync with Unraid theme (subtle). |

---

## Phase B — Operator tools (read + scoped writes)

| Feature | GraphQL | Notes |
|--------|---------|--------|
| **Notification inbox** | `notifications`, mutations `archiveNotification`, `deleteNotification`, … | Read/unread/archive from Overseer; confirm destructive actions. |
| **Array actions** | `Mutation.array` (`ArrayMutations`) | Start/stop array, disk mount — **high impact**; pin behind role check + double confirm. |
| **Parity control** | `parityCheck` mutations | Start/cancel parity — confirm + show `parityHistory` context. |
| **VM power** | `vm` / `VmMutations` | Start/stop VM (parallel to Docker power patterns). |
| **Docker mutations** | `docker` / `DockerMutations` | Beyond start/stop: if schema allows pull/update — gated. |
| **Flash backup** | `initiateFlashBackup` | One-shot action with status poll (`FlashBackupStatus`). |
| **UPS apply** | `configureUps` | Only if you want config from this UI (usually rare). |

---

## Phase C — Citizen / wall experience

| Feature | Notes |
|--------|--------|
| **Ambient “alert” strip** | Surface top 1–3 notifications or array warnings on TV mode. |
| **Lore + telemetry fusion** | Optional one-line status under portals (integrity, array state) without cluttering the chyron. |
| **Kiosk / auto-recover** | Fullscreen hint, reload on fatal fetch errors for wall mounts. |

---

## Phase D — Admin / advanced (optional)

| Feature | GraphQL | Notes |
|--------|---------|--------|
| **API key readout** | `apiKeys`, `apiKey(id)` | Never expose secrets in browser; server-side proxy only. |
| **Settings preview** | `settings`, `config` | Read-only diagnostics for support. |
| **OIDC / SSO** | `publicOidcProviders`, `isSSOEnabled` | Login UX if you ever embed authenticated views. |
| **Rclone / cloud** | `rclone`, `cloud` | Backup job status or links to Unraid pages. |

---

## Non-schema work

- **Build cache**: Docker BuildKit cache mounts for `apt` / `pip` to cut rebuild time.
- **Health endpoint**: `GET /api/health` for Unraid or reverse proxy.
- **Tests**: GraphQL response fixtures for `_hydrate_telemetry_panel` and disk size formatting.

---

## Permission reminder

Each field lists **Required Permissions** in the schema (e.g. `READ_ANY` on `ARRAY`, `LOGS`, `DOCKER`). The Vault app should degrade gracefully when a key lacks scope and surface a short hint in the diag / telemetry panel.

---

*Last updated: roadmap pass aligned with `schema.graphql` in-repo.*
