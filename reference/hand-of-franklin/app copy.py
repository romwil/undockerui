import os, json, logging, threading, queue, time, requests, subprocess, random
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Vault1848")
app = FastAPI()
templates = Jinja2Templates(directory="templates")

# Configuration
UNRAID_IP = "10.10.1.202:8081"
UNRAID_GRAPHQL = f"http://{UNRAID_IP}/graphql"
UNRAID_KEY = "9a043e6f576400c0ea1b9f290c7cfc142e7ee5aa1865942e3e63f5a1016a04b7"
VAULT_STATE_FILE = "vault_state.json"
LORE_FILE = "lore_vault.json"

def update_state(new_data):
    state = {}
    if os.path.exists(VAULT_STATE_FILE):
        try:
            with open(VAULT_STATE_FILE, 'r') as f: state = json.load(f)
        except: pass
    state.update(new_data)
    with open(VAULT_STATE_FILE, 'w') as f: json.dump(state, f)

@app.get("/api/probe")
async def probe_unraid():
    """The Kitchen Sink: Querying everything to find the valid keys."""
    headers = {"x-api-key": UNRAID_KEY, "Content-Type": "application/json"}
    query = """
    query {
      server { name status uptime }
      system { cpu { load } memory { used total } }
      storage { disks { name temp assigned status } }
      docker { containers { name state } }
    }
    """
    try:
        r = requests.post(UNRAID_GRAPHQL, json={'query': query}, headers=headers, timeout=5)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

@app.get("/probe", response_class=HTMLResponse)
async def probe_page(request: Request):
    return templates.TemplateResponse("probe.html", {"request": request})

@app.get("/overseer", response_class=HTMLResponse)
async def overseer_office(request: Request):
    return templates.TemplateResponse("overseer_vault.html", {"request": request})

@app.get("/", response_class=HTMLResponse)
async def public_terminal(request: Request):
    return templates.TemplateResponse("public_vault.html", {"request": request})

@app.get("/api/telemetry")
async def get_telemetry():
    if os.path.exists(VAULT_STATE_FILE):
        with open(VAULT_STATE_FILE, 'r') as f: return json.load(f)
    return {"status": "scanning"}