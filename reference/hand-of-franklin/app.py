import os, re, json, logging, shutil, threading, queue, time, requests, subprocess, random, asyncio, socket as socket_mod, http.client
from pathlib import Path
from urllib.parse import quote
from fastapi import FastAPI, Request, Form, Query, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vault1848")

# Persistent data directory (state, config, lore). Default: ./data next to app.
# On Unraid set VAULT_DATA_DIR=/mnt/user/appdata/hand-of-franklin/data
DATA_DIR = Path(os.getenv("VAULT_DATA_DIR", str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
# One-time seed: copy bundled lore into data dir if missing
_bundled_lore = BASE_DIR / "lore_vault.json"
if not (DATA_DIR / "lore_vault.json").exists() and _bundled_lore.exists():
    try:
        shutil.copy2(_bundled_lore, DATA_DIR / "lore_vault.json")
        logger.info("Seeded lore_vault.json into data directory")
    except OSError as e:
        logger.warning("Could not seed lore: %s", e)
logger.info("Data directory: %s", DATA_DIR)

# Unraid API: set UNRAID_GRAPHQL to full URL. Default is http://IP:8081/graphql (standard Unraid). If you get "not JSON", try /graphql or set UNRAID_GRAPHQL=http://IP:8081.
UNRAID_IP = os.getenv("UNRAID_IP", "127.0.0.1")
_default_graphql = f"http://{UNRAID_IP}:{os.getenv('UNRAID_GRAPHQL_PORT', '8081')}/graphql"
_raw_graphql = os.getenv("UNRAID_GRAPHQL", "").strip() or _default_graphql
# Normalize URL: ensure http:// or https:// prefix, fix double slashes
if _raw_graphql.startswith("http:/") and not _raw_graphql.startswith("http://"):
    _raw_graphql = _raw_graphql.replace("http:/", "http://", 1)
if _raw_graphql.startswith("https:/") and not _raw_graphql.startswith("https://"):
    _raw_graphql = _raw_graphql.replace("https:/", "https://", 1)
UNRAID_GRAPHQL = _raw_graphql
UNRAID_KEY = os.getenv("UNRAID_KEY", "default-key")
# Web UI base for “open in Unraid” links (no trailing slash)
_uw = os.getenv("UNRAID_WEBUI", "").strip().rstrip("/")
UNRAID_WEBUI = _uw if _uw else f"http://{UNRAID_IP}"
logger.info("Unraid API: %s", UNRAID_GRAPHQL)

# WebUI map: container name -> URL. Load from data/webui_map.json if present.
def _load_webui_map():
    path = DATA_DIR / "webui_map.json"
    if path.exists():
        try:
            with open(path, "r") as f:
                m = json.load(f)
            if isinstance(m, dict):
                return m
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to load webui_map.json: %s", e)
    return {
        "Plexomat": "http://10.10.1.200:32400/web",
        "sabnzbd": "http://10.10.1.201:8080",
        "MeTube": "http://10.10.1.203:8081",
        "Radarr": "http://10.10.1.210:7878",
        "Sonarr": "http://10.10.1.220:8989",
        "Seerr": "http://10.10.1.121:5055",
        "Pihole-Alpha": "http://10.10.1.222/admin",
        "Pihole-Beta": "http://10.10.1.223/admin",
        "PeaNUT": "http://10.10.1.202:8080",
    }

# GNR (Galaxy News Radio) stream source — YouTube live URL, etc. WSTE_RADIO_URL kept as legacy alias.
GNR_RADIO_URL = (
    os.getenv("GNR_RADIO_URL", "").strip()
    or os.getenv("WSTE_RADIO_URL", "").strip()
    or "https://www.youtube.com/live/6qQ0TMK7ZuE"
)
# YouTube extraction requires a JS runtime (node, deno, …). Dockerfile installs nodejs; override e.g. "deno" or "node:/path".
YTDLP_JS_RUNTIMES = os.getenv("YTDLP_JS_RUNTIMES", "node").strip()


def _normalize_http_headers(h):
    if not isinstance(h, dict):
        return {}
    return {str(k): str(v) for k, v in h.items() if v is not None}


def _pick_audio_stream(info: dict):
    """From yt-dlp -j output, return (url, http_headers) for audio playback."""
    if not isinstance(info, dict):
        return None, {}
    hdrs = _normalize_http_headers(info.get("http_headers"))
    if info.get("url"):
        return str(info["url"]), hdrs
    for rf in info.get("requested_formats") or []:
        if not isinstance(rf, dict) or not rf.get("url"):
            continue
        ac = str(rf.get("acodec") or "").lower()
        if ac and ac != "none":
            return str(rf["url"]), _normalize_http_headers(rf.get("http_headers")) or hdrs
    best = None
    best_abr = -1.0
    for f in info.get("formats") or []:
        if not isinstance(f, dict) or not f.get("url"):
            continue
        vc = str(f.get("vcodec") or "").lower()
        ac = str(f.get("acodec") or "").lower()
        if not ac or ac == "none" or (vc and vc != "none"):
            continue
        try:
            abr = float(f.get("abr") or f.get("tbr") or 0)
        except (TypeError, ValueError):
            abr = 0.0
        if abr >= best_abr:
            best_abr = abr
            best = f
    if best:
        return str(best["url"]), _normalize_http_headers(best.get("http_headers")) or hdrs
    return None, {}


def _ffmpeg_header_args(headers: dict):
    if not headers:
        return []
    lines = "".join(f"{k}: {v}\r\n" for k, v in headers.items())
    return ["-headers", lines]


app = FastAPI()
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
_state_lock = threading.Lock()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

task_queue = queue.Queue()

def _graphql_post(query: str, variables=None):
    headers = {"x-api-key": UNRAID_KEY, "Content-Type": "application/json"}
    payload = {"query": query}
    if variables is not None:
        payload["variables"] = variables
    r = requests.post(UNRAID_GRAPHQL, json=payload, headers=headers, timeout=30)
    try:
        body = r.json()
    except requests.exceptions.JSONDecodeError:
        return {"http": r.status_code, "ok": False, "detail": (r.text or "")[:200]}
    if r.status_code != 200:
        return {"http": r.status_code, "ok": False, "detail": str(body.get("errors", body))[:300]}
    if body.get("errors"):
        return {"http": 200, "ok": False, "detail": str(body.get("errors"))[:300]}
    return {"http": 200, "ok": True, "data": body.get("data")}

def _record_docker_action(cid, cmd, result):
    update_state({
        "last_docker_action": {
            "ts": time.strftime("%H:%M:%S"),
            "container_id": (cid or "")[:24] + "…" if cid and len(cid) > 24 else (cid or ""),
            "cmd": cmd,
            "ok": result.get("ok"),
            "detail": result.get("detail", "")[:400],
        }
    })

def update_state(new_data):
    path = DATA_DIR / "vault_state.json"
    with _state_lock:
        state = {}
        if path.exists():
            try:
                with open(path, 'r') as f:
                    state = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("State file read failed: %s", e)
        state.update(new_data)
        with open(path, 'w') as f:
            json.dump(state, f)


def _gnr_resolve_stream():
    """Run yt-dlp; store URL in vault state. Returns (ok, error_message_or_none)."""
    off = {"radio_status": "OFF", "radio_url": None, "radio_headers": {}}
    try:
        cmd = [
            "yt-dlp",
            "--no-check-certificate",
            "--no-playlist",
            "-f",
            "bestaudio/best",
            "-j",
            GNR_RADIO_URL,
        ]
        if YTDLP_JS_RUNTIMES:
            cmd.insert(1, "--js-runtimes")
            cmd.insert(2, YTDLP_JS_RUNTIMES)
        raw = subprocess.check_output(cmd, timeout=120).decode().strip()
        if not raw:
            raise ValueError("empty yt-dlp output")
        try:
            info = json.loads(raw)
        except json.JSONDecodeError:
            info = json.loads(raw.split("\n", 1)[0])
        url, hdrs = _pick_audio_stream(info)
        if not url:
            logger.warning("GNR: no audio URL in yt-dlp output")
            update_state(off)
            return False, "No audio URL in yt-dlp output"
        update_state({"radio_url": url, "radio_headers": hdrs, "radio_status": "ON"})
        logger.info("GNR stream resolved OK")
        return True, None
    except FileNotFoundError:
        logger.warning("yt-dlp not installed; GNR disabled")
        update_state(off)
        return False, "yt-dlp not installed in container"
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, json.JSONDecodeError, ValueError) as e:
        logger.warning("GNR resolve failed: %s", e)
        update_state(off)
        return False, (str(e).split("\n")[0])[:220]


def _gnr_clear_stream():
    update_state({"radio_status": "OFF", "radio_url": None, "radio_headers": {}})


def _gnr_load_stream_from_state():
    """Read radio_url and headers from vault state."""
    path = DATA_DIR / "vault_state.json"
    with _state_lock:
        if not path.exists():
            return None, {}
        try:
            with open(path, "r") as f:
                state = json.load(f)
        except (json.JSONDecodeError, OSError):
            return None, {}
    url = state.get("radio_url")
    hdrs = dict(state.get("radio_headers") or {})
    return url, hdrs


def _gnr_streaming_response(url: str, hdrs: dict):
    """StreamingResponse relaying upstream audio (same-origin for the browser)."""
    hdrs = dict(hdrs)
    hdrs.setdefault("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
    hdrs.setdefault("Referer", "https://www.youtube.com/")
    low = url.lower()
    use_ffmpeg = ".m3u8" in low or ".mpd" in low

    if use_ffmpeg:
        ff = ["ffmpeg", "-nostdin", "-loglevel", "error", "-threads", "1"]
        ff.extend(_ffmpeg_header_args(hdrs))
        ff.extend(["-i", url, "-vn", "-f", "mp3", "-acodec", "libmp3lame", "-b:a", "128k", "pipe:1"])
        proc = subprocess.Popen(ff, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if not proc.stdout:
            raise HTTPException(status_code=502, detail="ffmpeg failed to start")

        def ffmpeg_chunks():
            try:
                while True:
                    block = proc.stdout.read(64 * 1024)
                    if not block:
                        break
                    yield block
            finally:
                proc.kill()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass

        return StreamingResponse(ffmpeg_chunks(), media_type="audio/mpeg")

    req = requests.get(url, stream=True, headers=hdrs, timeout=60)
    if req.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Upstream HTTP {req.status_code}")

    def gen():
        try:
            for chunk in req.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
        finally:
            req.close()

    ct = req.headers.get("Content-Type", "audio/mp4")
    return StreamingResponse(gen(), media_type=ct)


def _lore_path():
    return DATA_DIR / "lore_vault.json" if (DATA_DIR / "lore_vault.json").exists() else BASE_DIR / "lore_vault.json"

def _lore_stream():
    path = _lore_path()
    if not path.exists():
        return "AWAITING DATA CORE..."
    with open(path, 'r') as f:
        lore = json.load(f)
    random.shuffle(lore)
    return " +++ ".join(lore[:50]) if len(lore) > 50 else " +++ ".join(lore)


def _kb_human(kb):
    """Unraid Share sizes are in KB (SDL)."""
    if kb is None:
        return None
    try:
        b = int(kb) * 1024
    except (TypeError, ValueError):
        return str(kb)
    if b <= 0:
        return "0"
    for label, div in (("TB", 1024 ** 4), ("GB", 1024 ** 3), ("MB", 1024 ** 2)):
        if b >= div:
            return f"{b / div:.1f} {label}"
    return f"{max(b // 1024, 0)} KB"


def _bytes_human(b):
    """Metrics memory total/used are bytes (BigInt)."""
    if b is None:
        return None
    try:
        n = int(b)
    except (TypeError, ValueError):
        return str(b)
    if n < 0:
        n = 0
    units = ("B", "KB", "MB", "GB", "TB")
    i = 0
    x = float(n)
    while x >= 1024 and i < len(units) - 1:
        x /= 1024.0
        i += 1
    if i == 0:
        return f"{int(x)} B"
    return f"{x:.1f} {units[i]}"


def _unwrap_capacity_value(val):
    """GraphQL may return scalars or nested objects for capacity fields."""
    if val is None:
        return None
    if isinstance(val, dict):
        for k in ("value", "raw", "kilobytes", "string", "toString"):
            if val.get(k) is not None:
                return _unwrap_capacity_value(val.get(k))
        return None
    return val


def _unraid_capacity_field_to_kb(val):
    """Parse Unraid `capacity.kilobytes` String fields into float KB for ratios."""
    val = _unwrap_capacity_value(val)
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        pass
    s2 = re.sub(r"\s+", "", s.lower())
    m = re.match(r"^([\d.]+)(tib|tb|gib|gb|mib|mb|kib|kb)?$", s2)
    if not m:
        return None
    num = float(m.group(1))
    unit = m.group(2) or "kb"
    mult = {
        "kb": 1.0,
        "kib": 1.0,
        "mb": 1024.0,
        "mib": 1024.0,
        "gb": 1024.0 ** 2,
        "gib": 1024.0 ** 2,
        "tb": 1024.0 ** 3,
        "tib": 1024.0 ** 3,
    }
    return num * mult.get(unit, 1.0)


def _capacity_field_human(val):
    """Human-readable size from Unraid capacity.kilobytes fields (numeric or compact strings)."""
    kb = _unraid_capacity_field_to_kb(val)
    if kb is None:
        return None
    try:
        return _kb_human(int(round(kb)))
    except (TypeError, ValueError, OverflowError):
        return str(val) if val is not None else None


def _capacity_field_decimal_tb(val):
    """Decimal TB for array capacity (matches storage matrix / tooltips)."""
    kb = _unraid_capacity_field_to_kb(val)
    if kb is None:
        return None
    try:
        b = int(round(float(kb))) * 1024
    except (TypeError, ValueError, OverflowError):
        return None
    if b <= 0:
        return "0.00 TB"
    return f"{b / 1e12:.2f} TB"


def _kb_to_decimal_tb_str(kb):
    """Share sizes from GraphQL (KB) → decimal TB string."""
    if kb is None:
        return None
    try:
        b = int(kb) * 1024
    except (TypeError, ValueError):
        return str(kb)
    if b <= 0:
        return "0.00 TB"
    return f"{b / 1e12:.2f} TB"


def _array_capacity_pct_used(cap_kb: dict):
    """Percent of array space used (same kilobyte basis as Unraid capacity)."""
    if not isinstance(cap_kb, dict):
        return None
    used = _unraid_capacity_field_to_kb(cap_kb.get("used"))
    total = _unraid_capacity_field_to_kb(cap_kb.get("total"))
    free = _unraid_capacity_field_to_kb(cap_kb.get("free"))
    if total and total > 0 and used is not None and used >= 0:
        return round(100.0 * min(used, total) / total, 1)
    if used is not None and free is not None and (used + free) > 0:
        t = used + free
        return round(100.0 * used / t, 1)
    if total and total > 0 and free is not None and free >= 0:
        used_est = max(total - free, 0.0)
        return round(100.0 * min(used_est, total) / total, 1)
    return None


def _unraid_array_disk_size_to_bytes(sz_raw):
    """
    GraphQL ArrayDisk.size is documented as KB (1024-byte units).
    Some responses return total size in bytes; normalize to byte count.
    """
    if sz_raw is None:
        return None
    try:
        n = int(float(sz_raw))
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    # Values this large are only plausible as bytes (e.g. multi-TB disks); KB would be astronomical.
    if n >= 100_000_000_000:
        return n
    return n * 1024


def _format_disk_size_decimal_tb(bytes_val) -> str | None:
    """Decimal TB for matrix tooltips (roadmap: same TB language everywhere)."""
    if bytes_val is None or bytes_val <= 0:
        return None
    try:
        b = int(bytes_val)
    except (TypeError, ValueError):
        return None
    return f"{b / 1e12:.2f} TB"


def _bytes_to_tb_decimal(bytes_val):
    if bytes_val is None or bytes_val <= 0:
        return None
    try:
        b = int(bytes_val)
    except (TypeError, ValueError):
        return None
    return round(b / 1e12, 2)


class _UnixDockerHTTPConnection(http.client.HTTPConnection):
    """HTTP over Docker's Unix socket (Engine API)."""

    def __init__(self, uds_path: str):
        super().__init__("localhost")
        self._uds_path = uds_path

    def connect(self):
        self.sock = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        self.sock.connect(self._uds_path)


def _docker_demux_stream(raw: bytes) -> str:
    """Decode Docker Engine multiplexed log stream (stdout/stderr frames)."""
    if not raw:
        return ""
    if raw[0] not in (0, 1, 2):
        return raw.decode("utf-8", errors="replace")
    parts = []
    i = 0
    while i + 8 <= len(raw):
        sz = int.from_bytes(raw[i + 4 : i + 8], "big")
        i += 8
        if sz < 0 or sz > 16 * 1024 * 1024 or i + sz > len(raw):
            break
        parts.append(raw[i : i + sz].decode("utf-8", errors="replace"))
        i += sz
    if not parts and raw:
        return raw.decode("utf-8", errors="replace")
    return "".join(parts)


def _docker_engine_log_lines(container_ref: str, tail: int = 80):
    """
    Last log lines via Docker Engine API on /var/run/docker.sock.
    Used when Unraid GraphQL has no docker.logs (older / plugin API). Mount host docker.sock to enable.
    """
    uds = "/var/run/docker.sock"
    if not os.path.exists(uds):
        return None
    cid = (container_ref or "").strip()
    if ":" in cid:
        cid = cid.split(":", 1)[1]
    if not cid:
        return None
    path = f"/v1.41/containers/{quote(cid, safe='')}/logs?stdout=1&stderr=1&tail={tail}&timestamps=0"
    try:
        conn = _UnixDockerHTTPConnection(uds)
        conn.request("GET", path)
        resp = conn.getresponse()
        body = resp.read()
        conn.close()
        if resp.status != 200:
            logger.warning("Docker engine logs %s for %s: HTTP %s", path[:80], cid[:20], resp.status)
            return None
    except OSError as e:
        logger.warning("Docker socket logs: %s", e)
        return None
    text = _docker_demux_stream(body)
    lines = text.splitlines()
    if len(lines) > tail:
        lines = lines[-tail:]
    return [ln[:500] for ln in lines]


def _graphql_error_suggests_missing_docker_logs(detail: str) -> bool:
    d = (detail or "").lower()
    return 'cannot query field "logs"' in d or "cannot query field 'logs'" in d


_RE_DOCKER_JSON_LOG = re.compile(r"/containers/([a-f0-9]{64})/", re.I)
_log_files_cache: dict = {"t": 0.0, "files": None}
_LOG_FILES_CACHE_TTL = 45.0


def _graphql_cached_log_files():
    """List host log files (Unraid Query.logFiles); short TTL to avoid spamming LOG clicks."""
    now = time.time()
    cached = _log_files_cache.get("files")
    if cached is not None and now - float(_log_files_cache.get("t") or 0) < _LOG_FILES_CACHE_TTL:
        return cached
    r = _graphql_post("query { logFiles { path name } }")
    if not r.get("ok"):
        logger.warning("logFiles query failed: %s", r.get("detail", "")[:200])
        return None
    files = (r.get("data") or {}).get("logFiles")
    if not isinstance(files, list):
        return None
    _log_files_cache["t"] = now
    _log_files_cache["files"] = files
    return files


def _docker_json_log_path_for_container(container_ref: str, log_files: list) -> str | None:
    """Match /var/lib/docker/containers/<id>/<id>-json.log from logFiles list."""
    raw = (container_ref or "").strip()
    if ":" in raw:
        raw = raw.split(":", 1)[1].strip().lower()
    else:
        raw = raw.lower()
    if not raw:
        return None
    best = None
    for f in log_files:
        if not isinstance(f, dict):
            continue
        p = (f.get("path") or "").strip()
        if not p or "-json.log" not in p.lower():
            continue
        norm = p.replace("\\", "/")
        low = norm.lower()
        if "/containers/" not in low:
            continue
        m = _RE_DOCKER_JSON_LOG.search(norm)
        cid64 = m.group(1).lower() if m else ""
        if cid64:
            if cid64 == raw or (len(raw) < 64 and cid64.startswith(raw)):
                return p
        elif raw in low:
            best = best or p
    return best


def _parse_docker_json_log_text(content: str, tail: int) -> list:
    """Decode Docker json-file log lines into plain text lines."""
    out = []
    for raw in (content or "").splitlines():
        s = raw.strip()
        if not s:
            continue
        try:
            j = json.loads(s)
            msg = j.get("log")
            if msg is None:
                msg = s
            else:
                msg = str(msg).rstrip("\r\n")
        except (json.JSONDecodeError, TypeError):
            msg = s
        out.append(str(msg)[:500])
    if len(out) > tail:
        out = out[-tail:]
    return out


def _graphql_docker_logfile_tail(container_ref: str, tail: int = 80):
    """
    Last log lines via Query.logFile (docker container json log on host).
    Unraid 7.x schema often has no Docker.logs; this uses READ_ANY on LOGS.
    Uses totalLines + startLine when available so we read the tail of the file.
    """
    files = _graphql_cached_log_files()
    if not files:
        return None
    path = _docker_json_log_path_for_container(container_ref, files)
    if not path:
        logger.info("No docker json log path matched for container ref %s", (container_ref or "")[:40])
        return None
    q_head = """query VaultLogHead($p: String!) {
      logFile(path: $p, lines: 1) { totalLines }
    }"""
    rh = _graphql_post(q_head, {"p": path})
    n = max(1, min(500, tail))
    start_line = None
    if rh.get("ok"):
        head = (rh.get("data") or {}).get("logFile") or {}
        tl = head.get("totalLines")
        try:
            tl_i = int(tl)
            if tl_i > 0:
                start_line = max(1, tl_i - n + 1)
        except (TypeError, ValueError):
            pass
    if start_line is not None:
        q = """query VaultLogTail($p: String!, $s: Int!, $n: Int!) {
          logFile(path: $p, startLine: $s, lines: $n) { content totalLines startLine }
        }"""
        r = _graphql_post(q, {"p": path, "s": start_line, "n": n})
    else:
        q = """query VaultLogFile($p: String!, $n: Int!) {
          logFile(path: $p, lines: $n) { content totalLines startLine }
        }"""
        r = _graphql_post(q, {"p": path, "n": n})
    if not r.get("ok"):
        logger.warning("logFile(%s...) failed: %s", path[:48], str(r.get("detail", ""))[:200])
        return None
    block = (r.get("data") or {}).get("logFile") or {}
    content = block.get("content")
    if content is None:
        return None
    return _parse_docker_json_log_text(str(content), tail)


def _hydrate_telemetry_panel(tp: dict) -> dict:
    """Fix stale/partial state: humanize raw capacity strings, fill pct, web UI, plugin count."""
    if not isinstance(tp, dict):
        return tp
    out = dict(tp)
    cap = {"free": out.get("array_free"), "used": out.get("array_used"), "total": out.get("array_total")}
    for fld in ("array_free", "array_used", "array_total"):
        raw = out.get(fld)
        human = _capacity_field_decimal_tb(raw) or _capacity_field_human(raw)
        if human:
            out[fld] = human
    pct = out.get("array_pct_used")
    if pct is None:
        p = _array_capacity_pct_used(cap)
        if p is not None:
            out["array_pct_used"] = p
    wu = (out.get("unraid_webui") or "").strip()
    if not wu:
        out["unraid_webui"] = UNRAID_WEBUI
    base = UNRAID_WEBUI or f"http://{UNRAID_IP}"
    if not (out.get("unraid_docker_url") or "").strip():
        out["unraid_docker_url"] = f"{base}/Docker"
    if out.get("plugins_count") is None:
        prev = out.get("plugins_preview")
        if isinstance(prev, list) and len(prev) > 0:
            out["plugins_count"] = len(prev)
    return out


def _unraid_graphql_data(query: str, headers: dict, label: str = "") -> dict | None:
    """
    Run a GraphQL query against UNRAID_GRAPHQL.
    Returns `data` dict, or None if HTTP error / response `data` is null (resolver failure).
    Logs GraphQL errors but still returns dict when partial data exists.
    """
    try:
        r = requests.post(UNRAID_GRAPHQL, json={"query": query}, headers=headers, timeout=10)
        if r.status_code != 200:
            logger.warning("GraphQL %s HTTP %s", label or "?", r.status_code)
            return None
        body = r.json()
    except Exception as e:
        logger.warning("GraphQL %s: %s", label or "?", e)
        return None
    if body.get("errors"):
        logger.warning("GraphQL %s errors: %s", label or "?", body.get("errors"))
    d = body.get("data")
    if d is None:
        return None
    return d if isinstance(d, dict) else {}


# Split telemetry into multiple queries so one brittle resolver (UPS, flash, notifications, …)
# does not null out the entire payload (GraphQL non-null propagation).
_VAULT_GQL_CORE = """query VaultTelemetryCore {
  server { name status }
  info { os { uptime } }
  metrics { cpu { percentTotal } memory { total used percentTotal } }
  vars { version name timeZone }
  array {
    state
    capacity { kilobytes { free used total } }
    parityCheckStatus { status progress correcting paused errors }
    disks { name temp status size device type rotational isSpinning idx fsType }
    parities { name temp status size device type rotational isSpinning idx fsType }
    caches { name temp status size device type rotational isSpinning idx fsType }
  }
}"""
_VAULT_GQL_DOCKER = """query VaultTelemetryDocker {
  docker {
    containers {
      id names state status image
      ports { ip privatePort publicPort type }
      autoStart
      labels
    }
  }
}"""
_VAULT_GQL_NOTIFICATIONS = """query VaultTelemetryNotifications {
  notifications {
    overview { unread { alert warning info total } }
    list(filter: { type: UNREAD, offset: 0, limit: 8 }) {
      title subject importance
    }
  }
}"""
_VAULT_GQL_PLUGINS = """query VaultTelemetryPlugins { plugins { name version } }"""
_VAULT_GQL_SHARES = """query VaultTelemetryShares { shares { name free used size } }"""
_VAULT_GQL_VMS = """query VaultTelemetryVms { vms { domains { name state } } }"""
_VAULT_GQL_FLASH = """query VaultTelemetryFlash {
  flash { vendor product }
}"""


def _docker_labels(obj):
    raw = obj.get("labels")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return {}


def _ports_to_lan_strings(ports):
    """Build short port descriptions from DockerContainer.ports (schema has no lanIpPorts)."""
    if not isinstance(ports, list):
        return []
    out = []
    for p in ports:
        if not isinstance(p, dict):
            continue
        typ = str(p.get("type") or "TCP").lower()
        priv, pub = p.get("privatePort"), p.get("publicPort")
        ip = (p.get("ip") or "").strip() or None
        if pub is not None and priv is not None:
            host = ip or "0.0.0.0"
            out.append(f"{host}:{pub}->{priv}/{typ}")
        elif priv is not None:
            out.append(f"{priv}/{typ}")
    return out


def vault_heartbeat():
    while True:
        try:
            headers = {"x-api-key": UNRAID_KEY, "Content-Type": "application/json"}
            # Split into several queries so one brittle resolver (UPS removed; flash, notifications, …)
            # cannot null the entire GraphQL `data` object via non-null propagation.
            core = _unraid_graphql_data(_VAULT_GQL_CORE, headers, "core")
            if core is None:
                raise RuntimeError("GraphQL returned no data")
            docker = _unraid_graphql_data(_VAULT_GQL_DOCKER, headers, "docker") or {}
            notifications = _unraid_graphql_data(_VAULT_GQL_NOTIFICATIONS, headers, "notifications") or {}
            plugins = _unraid_graphql_data(_VAULT_GQL_PLUGINS, headers, "plugins") or {}
            shares = _unraid_graphql_data(_VAULT_GQL_SHARES, headers, "shares") or {}
            vms = _unraid_graphql_data(_VAULT_GQL_VMS, headers, "vms") or {}
            flash = _unraid_graphql_data(_VAULT_GQL_FLASH, headers, "flash") or {}
            d = {**core, **docker, **notifications, **plugins, **shares, **vms, **flash}
            srv = d.get('server', {}) or {}
            inf = d.get('info', {}) or {}
            metrics = d.get('metrics', {}) or {}
            arr = d.get('array', {}) or d.get('storage', {})
            uptime = (inf.get('os') or {}).get('uptime') or '?'
            cpu_pct = metrics.get('cpu', {}).get('percentTotal')
            cpu_pct = round(float(cpu_pct)) if cpu_pct is not None else '?'
            mem = metrics.get('memory', {}) or {}
            mem_pct = mem.get('percentTotal')
            mem_pct = round(float(mem_pct)) if mem_pct is not None else '?'
            mem_total = mem.get("total")
            mem_used = mem.get("used")

            raw_disks = list(arr.get('disks', [])) + list(arr.get('parities', [])) + list(arr.get('caches', []))
            disks = []
            for dk in raw_disks:
                sz = dk.get("size")
                sz_human = None
                sz_display = None
                sz_tb = None
                b_disk = _unraid_array_disk_size_to_bytes(sz)
                if b_disk is not None:
                    sz_display = _format_disk_size_decimal_tb(b_disk)
                    sz_human = sz_display
                    sz_tb = _bytes_to_tb_decimal(b_disk)
                t_disk = dk.get("temp")
                disks.append({
                    "name": dk.get("name") or "?",
                    "temp": t_disk,
                    "temp_c": t_disk,
                    "status": dk.get("status"),
                    "size_tb": sz_tb,
                    "size_human": sz_human,
                    "size_display": sz_display,
                    "device": dk.get("device"),
                    "type": dk.get("type"),
                    "rotational": dk.get("rotational"),
                    "isSpinning": dk.get("isSpinning"),
                    "idx": dk.get("idx"),
                    "fsType": dk.get("fsType"),
                })

            webui_map = _load_webui_map()
            raw_containers = d.get('docker', {}) or {}
            if isinstance(raw_containers, list):
                raw_containers = {"containers": raw_containers}
            containers = (raw_containers.get('containers') or raw_containers) if isinstance(raw_containers, dict) else []
            dockers = []
            for c in containers:
                names = c.get('names') or [c.get('name', '?')]
                name = (names[0] if names else '?').replace('/', '')
                labels = _docker_labels(c)
                compose_project = (labels.get("com.docker.compose.project") or "").strip() or None
                compose_service = (labels.get("com.docker.compose.service") or "").strip() or None
                lan_raw = c.get("lanIpPorts")
                if isinstance(lan_raw, list) and lan_raw:
                    lan_ports = [str(x) for x in lan_raw if x is not None][:4]
                else:
                    lan_ports = _ports_to_lan_strings(c.get("ports"))[:4]
                tpl_ui = (c.get("webUiUrl") or "").strip()
                webui = tpl_ui or webui_map.get(name, f"http://{UNRAID_IP}")
                image = (c.get("image") or "?").split("/")[-1][:80]
                dockers.append({
                    "id": c.get('id', ''), "name": name, "state": str(c.get('state', '') or ''),
                    "status": c.get('status', ''), "webui": webui,
                    "image": image,
                    "compose_project": compose_project,
                    "compose_service": compose_service,
                    "lan_ports": lan_ports[:4],
                    "auto_start": c.get("autoStart"),
                    "is_orphaned": bool(c.get("isOrphaned")),
                    "update_available": bool(c.get("isUpdateAvailable")),
                })

            shares = d.get("shares") or []
            if not isinstance(shares, list):
                shares = []
            share_count = len(shares)
            shares_preview = []
            for sh in sorted(shares, key=lambda x: (x or {}).get("name") or "")[:16]:
                if not isinstance(sh, dict):
                    continue
                shares_preview.append({
                    "name": sh.get("name") or "?",
                    "free": _kb_to_decimal_tb_str(sh.get("free")),
                    "used": _kb_to_decimal_tb_str(sh.get("used")),
                    "total": _kb_to_decimal_tb_str(sh.get("size")),
                })
            vars_ = d.get("vars") or {}
            vms_root = d.get("vms") or {}
            domains = vms_root.get("domains") or []
            if not isinstance(domains, list):
                domains = []
            vm_running = sum(1 for v in domains if str((v or {}).get("state") or "").upper() == "RUNNING")
            cap_kb = (arr.get("capacity") or {}).get("kilobytes") or {}
            parity = arr.get("parityCheckStatus") or {}
            vms_preview = [{"name": (v or {}).get("name"), "state": (v or {}).get("state")} for v in domains[:12]]

            notif = d.get("notifications") or {}
            nov = (notif.get("overview") or {}).get("unread") or {}
            warns = notif.get("warningsAndAlerts") or notif.get("list") or []
            if not isinstance(warns, list):
                warns = []
            notif_preview = []
            for w in warns[:8]:
                if not isinstance(w, dict):
                    continue
                notif_preview.append({
                    "title": (w.get("title") or "")[:100],
                    "subject": (w.get("subject") or "")[:120],
                    "importance": w.get("importance"),
                })

            ups_list = d.get("upsDevices") or []
            if not isinstance(ups_list, list):
                ups_list = []
            ups_preview = []
            for u in ups_list[:4]:
                if not isinstance(u, dict):
                    continue
                bat = u.get("battery") or {}
                pow_ = u.get("power") or {}
                ups_preview.append({
                    "name": u.get("name"),
                    "model": u.get("model"),
                    "status": u.get("status"),
                    "charge": bat.get("chargeLevel"),
                    "runtime_s": bat.get("estimatedRuntime"),
                    "battery_health": bat.get("health"),
                    "load_pct": pow_.get("loadPercentage"),
                })

            fl = d.get("flash") or {}
            flash_label = None
            if isinstance(fl, dict):
                v = (fl.get("vendor") or "").strip()
                p = (fl.get("product") or "").strip()
                flash_label = f"{v} {p}".strip() or None
                if not flash_label and fl.get("guid"):
                    g = str(fl.get("guid", "")).strip()
                    flash_label = (f"FLASH {g[:20]}…" if len(g) > 20 else f"FLASH {g}") if g else None

            plugs = d.get("plugins") or []
            if not isinstance(plugs, list):
                plugs = []
            plugins_preview = [{"name": (p or {}).get("name"), "version": (p or {}).get("version")} for p in plugs[:24] if isinstance(p, dict)]

            # Server can be null on local node; status is ServerStatus (ONLINE/OFFLINE)
            srv_status = (srv.get('status') if srv else '') or ''
            srv_status = str(srv_status).upper()
            update_state({
                "vault_integrity": "STABLE" if (srv_status == 'ONLINE' or not srv_status) else "DEGRADED",
                "disks": disks,
                "docker": dockers,
                "telemetry_stream": f"UPTIME: {uptime} | CPU: {cpu_pct}% | RAM: {mem_pct}%",
                "telemetry_panel": {
                    "array_state": arr.get("state"),
                    "array_free": _capacity_field_human(cap_kb.get("free"))
                    or cap_kb.get("free"),
                    "array_used": _capacity_field_human(cap_kb.get("used"))
                    or cap_kb.get("used"),
                    "array_total": _capacity_field_human(cap_kb.get("total"))
                    or cap_kb.get("total"),
                    "array_pct_used": _array_capacity_pct_used(cap_kb),
                    "parity_status": parity.get("status"),
                    "parity_progress": parity.get("progress"),
                    "parity_paused": parity.get("paused"),
                    "parity_correcting": parity.get("correcting"),
                    "parity_errors": parity.get("errors"),
                    "unraid_version": vars_.get("version"),
                    "hostname": vars_.get("name"),
                    "timezone": vars_.get("timeZone"),
                    "share_count": share_count,
                    "shares_preview": shares_preview,
                    "docker_count": len(dockers),
                    "docker_running": sum(1 for x in dockers if str(x.get("state") or "").lower() == "running"),
                    "vm_count": len(domains),
                    "vm_running": vm_running,
                    "vms_preview": vms_preview,
                    "uptime": uptime,
                    "cpu_pct": cpu_pct,
                    "mem_pct": mem_pct,
                    "mem_total": _bytes_human(mem_total),
                    "mem_used": _bytes_human(mem_used),
                    "unraid_webui": UNRAID_WEBUI or f"http://{UNRAID_IP}",
                    "unraid_docker_url": f"{UNRAID_WEBUI or f'http://{UNRAID_IP}'}/Docker",
                    "notif_unread_alerts": nov.get("alert"),
                    "notif_unread_warnings": nov.get("warning"),
                    "notif_unread_info": nov.get("info"),
                    "notif_unread_total": nov.get("total"),
                    "notif_preview": notif_preview,
                    "ups_preview": ups_preview,
                    "flash_device": flash_label,
                    "plugins_count": len(plugs),
                    "plugins_preview": plugins_preview,
                },
                "lore_stream": _lore_stream(),
                "timestamp": time.strftime("%H:%M:%S")
            })
        except Exception as e:
            logger.exception("Heartbeat failed")
            err_msg = str(e).split("\n")[0][:50]
            update_state({
                "telemetry_stream": f"CONN ERR: {err_msg}",
                "lore_stream": _lore_stream(),
                "timestamp": time.strftime("%H:%M:%S"),
                "vault_integrity": "UNKNOWN"
            })
        time.sleep(15)

def franklin_worker():
    while True:
        task = task_queue.get()
        try:
            if task.get("action") == "docker_power":
                cid = task.get("id")
                cmd = task.get("cmd")
                if not cid or not cmd:
                    _record_docker_action(cid, cmd, {"ok": False, "detail": "missing id or cmd"})
                else:
                    cid_esc = str(cid).replace("\\", "\\\\").replace('"', '\\"')
                    if cmd == "restart":
                        r1 = _graphql_post(f'mutation {{ docker {{ stop(id: "{cid_esc}") {{ id }} }} }}')
                        if not r1.get("ok"):
                            _record_docker_action(cid, "restart(stop)", r1)
                            logger.warning("Docker restart stop failed: %s", r1)
                        else:
                            time.sleep(2)
                            r2 = _graphql_post(f'mutation {{ docker {{ start(id: "{cid_esc}") {{ id }} }} }}')
                            _record_docker_action(cid, "restart", r2)
                            if not r2.get("ok"):
                                logger.warning("Docker restart start failed: %s", r2)
                    elif cmd in ("start", "stop", "pause", "unpause"):
                        r = _graphql_post(f'mutation {{ docker {{ {cmd}(id: "{cid_esc}") {{ id }} }} }}')
                        _record_docker_action(cid, cmd, r)
                        if not r.get("ok"):
                            logger.warning("Docker %s failed: %s", cmd, r)
                    else:
                        _record_docker_action(cid, cmd, {"ok": False, "detail": "unknown cmd"})
                    logger.info("Docker %s for container %s", cmd, cid[:12] if cid else "?")
        except Exception as e:
            logger.exception("Worker task failed: %s", task)
        finally:
            task_queue.task_done()

threading.Thread(target=vault_heartbeat, daemon=True).start()
threading.Thread(target=franklin_worker, daemon=True).start()

@app.get("/", response_class=HTMLResponse)
async def public_vault(request: Request):
    return templates.TemplateResponse("public_vault.html", {"request": request, "tv_mode": False})

@app.get("/tv", response_class=HTMLResponse)
async def public_vault_tv(request: Request):
    """Large-type Citizen layout for wall / TV browsers (bookmark on Shield, Fire TV, etc.)."""
    return templates.TemplateResponse("public_vault.html", {"request": request, "tv_mode": True})

@app.get("/overseer", response_class=HTMLResponse)
async def overseer_vault(request: Request):
    return templates.TemplateResponse("overseer_vault.html", {"request": request, "noc_tv": False})


@app.get("/overseer/tv", response_class=HTMLResponse)
async def overseer_noc_tv(request: Request):
    """Read-only NOC layout: large type, single column, running containers only, no docker controls."""
    return templates.TemplateResponse("overseer_vault.html", {"request": request, "noc_tv": True})

@app.get("/help/citizen", response_class=HTMLResponse)
async def help_citizen(request: Request):
    return templates.TemplateResponse("help_citizen.html", {"request": request})

@app.get("/help/overseer", response_class=HTMLResponse)
async def help_overseer(request: Request):
    return templates.TemplateResponse("help_overseer.html", {"request": request})

def _telemetry_public_payload(state: dict):
    """Omit raw stream URL/headers from API (use POST /api/gnr/start then GET /api/gnr/stream)."""
    out = dict(state)
    out.pop("radio_url", None)
    out.pop("radio_headers", None)
    tp = out.get("telemetry_panel")
    if not isinstance(tp, dict):
        tp = {}
    out["telemetry_panel"] = _hydrate_telemetry_panel(tp)
    return out


@app.get("/api/telemetry")
async def get_telemetry():
    path = DATA_DIR / "vault_state.json"
    with _state_lock:
        if path.exists():
            try:
                with open(path, 'r') as f:
                    return _telemetry_public_payload(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass
    return {"status": "scanning", "lore_stream": _lore_stream(), "timestamp": time.strftime("%H:%M:%S")}


@app.post("/api/gnr/start")
@app.post("/api/wste/start", include_in_schema=False)
async def gnr_start():
    """Resolve stream with yt-dlp (may take ~10–60s). Then play from GET /api/gnr/stream."""
    ok, err = await asyncio.to_thread(_gnr_resolve_stream)
    if not ok:
        return JSONResponse({"ok": False, "error": err or "failed"}, status_code=502)
    return {"ok": True}


@app.post("/api/gnr/stop")
@app.post("/api/wste/stop", include_in_schema=False)
async def gnr_stop():
    """Clear server-side stream URL; stop browser audio separately."""
    await asyncio.to_thread(_gnr_clear_stream)
    return {"ok": True}


@app.get("/api/gnr/stream")
@app.get("/api/wste/stream", include_in_schema=False)
async def gnr_stream():
    """Same-origin relay for GNR / YouTube audio after /api/gnr/start."""
    url, hdrs = await asyncio.to_thread(_gnr_load_stream_from_state)
    if not url:
        raise HTTPException(status_code=404, detail="No GNR stream. POST /api/gnr/start first.")
    return _gnr_streaming_response(url, hdrs)


@app.get("/api/radio/proxy")
async def radio_proxy_legacy():
    """Deprecated alias for /api/gnr/stream (old bookmarks)."""
    url, hdrs = await asyncio.to_thread(_gnr_load_stream_from_state)
    if not url:
        raise HTTPException(status_code=404, detail="No stream. POST /api/gnr/start first.")
    return _gnr_streaming_response(url, hdrs)

@app.get("/api/lore")
async def get_lore():
    path = _lore_path()
    if path.exists():
        with open(path, 'r') as f:
            lore = json.load(f); random.shuffle(lore); return {"lore": " +++ ".join(lore)}
    return {"lore": "OFFLINE"}

@app.get("/api/portals")
async def get_portals():
    """Public vault links. From data/portals.json: [{"name": "PLEX", "url": "http://..."}, ...]"""
    path = DATA_DIR / "portals.json"
    if path.exists():
        try:
            with open(path, 'r') as f:
                data = json.load(f)
            if isinstance(data, list):
                return {"portals": [{"name": str(p.get("name", "")), "url": str(p.get("url", ""))} for p in data if isinstance(p, dict)]}
        except (json.JSONDecodeError, OSError):
            pass
    return {"portals": []}


@app.post("/api/docker/logs")
async def api_docker_logs(id: str = Form("")):
    cid = (id or "").strip()
    if not cid:
        return JSONResponse({"ok": False, "error": "missing id"}, status_code=400)
    try:
        q = """
        query VaultLogs($id: PrefixedID!) {
          docker { logs(id: $id, tail: 80) { lines { message } } }
        }
        """
        r = _graphql_post(q, {"id": cid})
        if r.get("ok"):
            data = r.get("data") or {}
            logs = ((data.get("docker") or {}).get("logs") or {}).get("lines") or []
            out = []
            for line in logs:
                if isinstance(line, dict) and line.get("message") is not None:
                    out.append(str(line["message"])[:500])
            return {"ok": True, "lines": out}

        via_logfile = await asyncio.to_thread(_graphql_docker_logfile_tail, cid, 80)
        if via_logfile is not None:
            return {"ok": True, "lines": via_logfile}

        sock_lines = await asyncio.to_thread(_docker_engine_log_lines, cid, 80)
        if sock_lines is not None:
            return {"ok": True, "lines": sock_lines}

        detail = str(r.get("detail", "graphql error"))
        if _graphql_error_suggests_missing_docker_logs(detail):
            return JSONResponse(
                {
                    "ok": False,
                    "error": "No docker.logs API, no matching *-json.log in logFiles, and no docker.sock. Grant READ_ANY on LOGS + DOCKER, or mount /var/run/docker.sock read-only.",
                },
                status_code=502,
            )
        if isinstance(detail, str) and (detail.strip().startswith("<") or "Internal Server" in detail):
            detail = "GraphQL request failed (check UNRAID_GRAPHQL URL and network)"
        return JSONResponse({"ok": False, "error": detail[:500]}, status_code=502)
    except Exception as e:
        logger.exception("docker logs endpoint failed for %s", (cid or "")[:32])
        return JSONResponse({"ok": False, "error": str(e).split("\n")[0][:200]}, status_code=500)


def _weather_for_zip(zip_code: str):
    z = (zip_code or "").strip()
    if not z or not z.replace("-", "").isdigit():
        return {"ok": False, "text": "Set a US ZIP in settings"}
    z = z.split("-")[0]
    try:
        zr = requests.get(f"https://api.zippopotam.us/us/{z}", timeout=6)
        if zr.status_code != 200:
            return {"ok": False, "text": f"ZIP lookup failed ({zr.status_code})"}
        zj = zr.json()
        pl = zj.get("places") or [{}]
        lat, lon = float(pl[0]["latitude"]), float(pl[0]["longitude"])
        place = pl[0].get("place name", "")
        st = pl[0].get("state abbreviation", "")
    except (requests.RequestException, KeyError, ValueError, IndexError) as e:
        return {"ok": False, "text": str(e)[:80]}
    try:
        wr = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat, "longitude": lon,
                "current": "temperature_2m,weather_code,wind_speed_10m",
                "temperature_unit": "fahrenheit", "wind_speed_unit": "mph",
            },
            timeout=6,
        )
        wj = wr.json()
        cur = wj.get("current") or {}
        t = cur.get("temperature_2m")
        wind = cur.get("wind_speed_10m")
        code = cur.get("weather_code")
        parts = [f"{place}, {st}" if st else place, f"{t}°F" if t is not None else None, f"wind {wind} mph" if wind is not None else None, f"code {code}" if code is not None else None]
        return {"ok": True, "text": " · ".join(p for p in parts if p)}
    except (requests.RequestException, KeyError, ValueError) as e:
        return {"ok": False, "text": str(e)[:80]}

@app.get("/api/weather")
async def api_weather(zip: str = Query("", alias="zip")):
    z = zip.strip() or os.getenv("WEATHER_ZIP", "").strip()
    w = _weather_for_zip(z)
    return {"weather": w.get("text", ""), "ok": w.get("ok", False)}

ALLOWED_DOCKER_CMDS = frozenset(("start", "stop", "restart", "pause", "unpause"))

@app.post("/execute")
async def execute(payload: str = Form(...)):
    try:
        task = json.loads(payload)
    except json.JSONDecodeError as e:
        return JSONResponse({"status": "ERROR", "error": "Invalid JSON"}, status_code=400)
    if not isinstance(task, dict):
        return JSONResponse({"status": "ERROR", "error": "Payload must be an object"}, status_code=400)
    action = task.get("action")
    if action == "docker_power":
        cid = task.get("id")
        cmd = task.get("cmd")
        if not cid or not cmd or cmd not in ALLOWED_DOCKER_CMDS:
            return JSONResponse({"status": "ERROR", "error": "docker_power requires id and cmd (start|stop|restart|pause|unpause)"}, status_code=400)
        task_queue.put(task)
        return {"status": "CMD_ENQUEUED", "payload": task, "hint": "Poll /api/telemetry for last_docker_action"}
    return JSONResponse({"status": "ERROR", "error": "Unknown action"}, status_code=400)