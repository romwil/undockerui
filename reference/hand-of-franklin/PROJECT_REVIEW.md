# Hand of Franklin — Project Review

## What the Project Provides

**Hand of Franklin** is a FastAPI dashboard that presents your Unraid server as a “Vault 1848” themed control panel (Fallout-style). It provides:

| Feature | Description |
|--------|-------------|
| **Overseer view** (`/`, `/overseer`) | Admin UI: disk matrix (temps), Docker container list with WebUI links and restart, live telemetry (uptime/CPU/RAM), scrolling “lore” ticker, GNR radio sync |
| **Public view** | `public_vault.html` exists but there is no route serving it in `app.py` |
| **Probe** | `probe.html` exists and calls `/api/probe`, but that route is not defined in the main `app.py` |
| **APIs** | `/api/telemetry` (JSON state), `/api/lore` (shuffled lore lines), `POST /execute` (enqueue tasks: sync_radio, docker_power) |
| **Background workers** | Heartbeat thread (Unraid GraphQL every 15s → `vault_state.json`), worker thread (radio sync via yt-dlp, Docker actions via GraphQL) |

So in practice you get: **Overseer dashboard**, **telemetry API**, **lore API**, and **execute (task queue)**. The “public vault” and “probe” UIs are not wired up in the main app.

---

## Quality Assessment

### Strengths

- **Theme and UX**: CRT scanlines, amber/green terminals, lore ticker and “Vault 1848” copy give a clear, consistent theme.
- **Lore content**: `lore_vault.json` is large and on-theme; the API shuffles and joins with `" +++ "` for the ticker.
- **Separation of concerns**: Background threads for polling vs. task execution; state in one JSON file.
- **Unraid integration**: Uses GraphQL for server/array/docker and a documented schema (`unraidquery.sdl`).

### Critical Issues

1. **Security — secrets in code**  
   - `UNRAID_KEY` and `UNRAID_IP` are hardcoded in `app.py`.  
   - `.env` exists (Jira, `HOST_IP`, `PORT`) but is not used for Unraid config.  
   - **Risk**: Keys in repo or images; no env-based config for Unraid.

2. **Broken Docker “Restart”**  
   - Worker uses:  
     `mutation { dockerContainerAction(id: "...", action: restart) }`  
   - `unraidquery.sdl` defines `DockerMutations` with `start(id)`, `stop(id)`, `pause(id)`, `unpause(id)` only — there is no `dockerContainerAction` or `restart`.  
   - **Effect**: Restart button does nothing or returns GraphQL errors.

3. **Public vault page not served**  
   - `templates/public_vault.html` is present but there is no route (e.g. `@app.get("/public")`) in `app.py` that renders it.

4. **Probe page broken**  
   - `probe.html` fetches `/api/probe`. That route exists in `app copy.py` but not in `app.py`, so the probe UI gets 404.

5. **Public vault data mismatch**  
   - `public_vault.html` uses `data.lore_stream` from the telemetry response.  
   - `app.py` only writes `telemetry_stream` (and similar) to state; it does not set `lore_stream`.  
   - So even if you add a route for the public page, the ticker would show `undefined` unless you also fix the data (e.g. add lore to the telemetry payload or have the page call `/api/lore`).

### Moderate Issues

6. **Dockerfile vs runtime**  
   - Dockerfile installs `jira` but the main app does not use it.  
   - App uses `requests` and (for radio) `yt-dlp`; Dockerfile does not list them. If the image is used as-is, radio sync and any `requests` usage may fail unless the base image already provides them.

7. **State and errors**  
   - `vault_heartbeat` catches all exceptions and only updates `telemetry_stream` with a short message; no logging.  
   - `franklin_worker` uses bare `except` and does not log.  
   - Makes production debugging and monitoring hard.

8. **Execute endpoint is open**  
   - `POST /execute` accepts arbitrary JSON and enqueues tasks (sync_radio, docker_power). There is no auth or rate limiting, so anyone who can reach the app can trigger these actions.

9. **Duplicate / legacy code**  
   - `app copy.py` and `vault1848/` look like an older or alternate version (different routes, probe, lore in state). Having both increases confusion and the chance of editing the wrong file.

---

## Potential Improvements

### High priority

- **Move Unraid config to env**  
  - e.g. `UNRAID_IP`, `UNRAID_KEY`, optionally `UNRAID_GRAPHQL`  
  - Load in `app.py` (e.g. `os.getenv` or `pydantic-settings`) and remove hardcoded values.

- **Fix Docker restart**  
  - Use the real Unraid API: e.g. call `mutation { docker { stop(id: "...") } }` then `mutation { docker { start(id: "...") } }`, or use a documented “restart” if the API adds one.  
  - Remove use of `dockerContainerAction`.

- **Add missing routes**  
  - Serve `public_vault.html` (e.g. `GET /public`) and implement `/api/probe` (and optionally `GET /probe` for the probe page) in the main `app.py`, or remove the unused templates and probe UI.

- **Align public vault with API**  
  - Either include lore (or a `lore_stream` field) in the telemetry response, or have the public page fetch `/api/lore` and use that for the ticker.  
  - Use the same field names in the template as in the API.

### Medium priority

- **Harden execute**  
  - Add authentication (e.g. API key or session) and/or rate limiting for `POST /execute`.

- **Dockerfile**  
  - Add `requests` (and `yt-dlp` if the container must run radio sync).  
  - Remove `jira` if unused, or add a minimal Jira feature that uses the existing `.env` Jira config.

- **Logging**  
  - Use `logging` in heartbeat and worker; log exceptions and important state changes (e.g. Unraid unreachable, task executed).

- **Cleanup**  
  - Remove or archive `app copy.py` and consolidate with `vault1848/` if that folder is obsolete, so there is one clear entrypoint (`app.py`).

### Nice to have

- **Health check**  
  - e.g. `GET /health` that checks Unraid reachability and/or state file freshness.

- **Error handling in API**  
  - Return proper HTTP status and JSON error bodies for missing state, invalid execute payloads, and GraphQL errors.

- **Docs**  
  - Short README: what the app does, required env vars, how to run (e.g. `uvicorn app:app` or Docker), and that Unraid GraphQL must be enabled and reachable.

---

## Summary

| Aspect | Rating | Notes |
|--------|--------|--------|
| Concept / theme | Strong | Clear “Vault” dashboard idea and copy |
| Functionality | Partial | Overseer + APIs work; public vault and probe not wired; Docker restart wrong |
| Security | Weak | Hardcoded secrets; execute unauthenticated |
| Maintainability | Mixed | Duplicate/legacy files; little logging |
| Production readiness | Low | Env config, deps, and error handling need work |

Addressing the critical items (secrets, Docker mutation, missing routes, and public vault data) would make the app consistent and usable; the rest would make it safer and easier to operate and extend.
