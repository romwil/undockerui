import os, json, logging, threading, queue, time, requests, subprocess, random
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Vault1848")
app = FastAPI()
templates = Jinja2Templates(directory="templates")
task_queue = queue.Queue()

UNRAID_IP = "10.10.1.202:8081"
UNRAID_KEY = "9a043e6f576400c0ea1b9f290c7cfc142e7ee5aa1865942e3e63f5a1016a04b7"
VAULT_STATE_FILE = "vault_state.json"
LORE_FILE = "lore_vault.json"

def load_lore():
    if os.path.exists(LORE_FILE):
        with open(LORE_FILE, 'r') as f: return json.load(f)
    return ["AWAITING DATA CORE..."]

def update_state(new_data):
    state = {}
    if os.path.exists(VAULT_STATE_FILE):
        try:
            with open(VAULT_STATE_FILE, 'r') as f: state = json.load(f)
        except: pass
    state.update(new_data)
    with open(VAULT_STATE_FILE, 'w') as f: json.dump(state, f)

def vault_heartbeat():
    lore_list = load_lore()
    while True:
        try:
            headers = {"x-api-key": UNRAID_KEY}
            query = "{ array { state status { description } } }"
            r = requests.post(f"http://{UNRAID_IP}/api/graphql", json={'query': query}, headers=headers, timeout=10)
            
            integrity = "OPTIMAL"
            if r.status_code == 200 and "Sync" in r.text: integrity = "RECONSTRUCTING (PARITY)"
            
            # BROADCAST LOGIC: Mega-String shuffling
            selected_lore = random.sample(lore_list, min(len(lore_list), 50))
            lore_mega_string = "  ---  ".join(selected_lore)
            
            telemetry_feed = f"INTEGRITY: {integrity} • REACTOR: 106 F • RADS: OPTIMAL • NODE: 10.10.1.21 • UPTIME: {time.strftime('%H:%M:%S')}"
            
            update_state({
                "vault_integrity": integrity,
                "lore_stream": lore_mega_string,
                "telemetry_stream": telemetry_feed,
                "timestamp": time.strftime("%H:%M:%S")
            })
        except: logger.error("Mainframe link severed.")
        time.sleep(120) # 2-minute poll to stay "stealthy"

def franklin_worker():
    while True:
        task = task_queue.get()
        if task.get("action") == "sync_radio":
            try:
                cmd = ["yt-dlp", "-g", "https://www.youtube.com/live/6qQ0TMK7ZuE"]
                url = subprocess.check_output(cmd).decode().strip()
                update_state({"radio_url": url, "radio_status": "LOCKED"})
            except: logger.error("Radio interference.")
        task_queue.task_done()

threading.Thread(target=vault_heartbeat, daemon=True).start()
threading.Thread(target=franklin_worker, daemon=True).start()

@app.get("/", response_class=HTMLResponse)
async def public_terminal(request: Request):
    return templates.TemplateResponse("public_vault.html", {"request": request})

@app.get("/overseer", response_class=HTMLResponse)
async def overseer_office(request: Request):
    return templates.TemplateResponse("overseer_vault.html", {"request": request})

@app.post("/execute")
async def execute(payload: str = Form(...)):
    task_queue.put(json.loads(payload))
    return {"status": "Enqueued"}

@app.get("/api/telemetry")
async def get_telemetry():
    if os.path.exists(VAULT_STATE_FILE):
        with open(VAULT_STATE_FILE, 'r') as f: return json.load(f)
    return {"status": "Scanning..."}