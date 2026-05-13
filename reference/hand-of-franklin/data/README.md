# Vault 1848 data directory

All persistent state and config live here. Set `VAULT_DATA_DIR` to this path (e.g. `/mnt/user/appdata/hand-of-franklin/data`) so the app uses it.

| File | Purpose |
|------|---------|
| `vault_state.json` | Runtime state (telemetry, docker list, timestamp). Written by the app. |
| `lore_vault.json` | Ticker lore lines (JSON array of strings). Editable. Seeded from app bundle if missing. |
| `webui_map.json` | Docker container name → Web UI URL. Used by Overseer for "Open" links. |
| `portals.json` | Public vault links. JSON array of `{"name": "...", "url": "..."}`. Shown on the citizen terminal. |

Env overrides (optional): `VAULT_DATA_DIR`, `UNRAID_IP`, `UNRAID_KEY`, `UNRAID_GRAPHQL`, `UNRAID_GRAPHQL_PORT`, `GNR_RADIO_URL`, `WEATHER_ZIP` (US ZIP for Citizen weather when no ZIP in browser settings).
