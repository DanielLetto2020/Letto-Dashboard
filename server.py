from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import json
import os
import psutil
import time
from datetime import datetime
import subprocess

app = FastAPI()
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASHBOARD_ROOT = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(DASHBOARD_ROOT, 'scripts/tokens.json')
HEARTBEAT_FILE = os.path.join(WORKSPACE_ROOT, 'HEARTBEAT.md')
HB_MARKER = os.path.join(WORKSPACE_ROOT, '.heartbeat_last_run')

class AuthRequest(BaseModel):
    token: str

class HeartbeatUpdate(BaseModel):
    token: str
    content: str

def get_server_uptime():
    lib_boot_time = psutil.boot_time()
    uptime_seconds = int(time.time() - lib_boot_time)
    return f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m"

def get_last_hb():
    if os.path.exists(HB_MARKER):
        return int(os.path.getmtime(HB_MARKER))
    return int(time.time())

def get_git_commits():
    try:
        output = subprocess.check_output("git -C " + DASHBOARD_ROOT + " log -5 --pretty=format:'%s|%ar'", shell=True).decode().splitlines()
        return [{"msg": l.split("|")[0], "date": l.split("|")[1]} for l in output if "|" in l]
    except: return []

def get_agents_info():
    agents = []
    try:
        cmd = "ps -eo pid,cmd | grep -E 'openclaw|node.*index.mjs|python3.*server.py' | grep -v grep"
        output = subprocess.check_output(cmd, shell=True).decode().splitlines()
        for l in output:
            l = l.strip()
            if not l: continue
            pid = l.split()[0]
            cmd_f = " ".join(l.split()[1:])
            name = "Letto UI Manager" if "server.py" in cmd_f else ("Letto Core Gateway" if "gateway" in cmd_f else "Main Session")
            agents.append({"pid": pid, "name": name})
    except: pass
    return agents

def verify_token_internal(token: str):
    if not os.path.exists(TOKEN_FILE): return False
    with open(TOKEN_FILE, 'r') as f:
        stored = json.load(f)
    return stored['token'] == token and datetime.now().timestamp() < stored['expires_at']

@app.get("/api/status")
async def get_status(token: str):
    if not verify_token_internal(token): raise HTTPException(status_code=401)
    
    hb_raw = ""
    if os.path.exists(HEARTBEAT_FILE):
        with open(HEARTBEAT_FILE, 'r') as f: hb_raw = f.read()

    return {
        "cpu": psutil.cpu_percent(),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent,
        "uptime": get_server_uptime(),
        "agents": get_agents_info(),
        "heartbeat_last": get_last_hb(),
        "heartbeat_raw": hb_raw,
        "commits": get_git_commits()
    }

@app.post("/api/heartbeat/update")
async def update_heartbeat(data: HeartbeatUpdate):
    if not verify_token_internal(data.token): raise HTTPException(status_code=401)
    with open(HEARTBEAT_FILE, 'w') as f: f.write(data.content)
    return {"success": True}

@app.post("/api/auth")
async def auth(data: AuthRequest):
    if verify_token_internal(data.token): return {"success": True}
    raise HTTPException(status_code=401)

@app.get("/", response_class=HTMLResponse)
async def index():
    return """
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <title>Letto | Mobile Command</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { background-color: #0f172a; color: white; font-family: 'JetBrains Mono', monospace; margin: 0; padding: 0; }
            .glow-text { text-shadow: 0 0 10px rgba(52, 211, 153, 0.4); }
            #desktop-view { display: none; }
            #mobile-view { display: block; }
            @media (min-width: 769px) { #desktop-view { display: flex; } #mobile-view { display: none; } }
            .stat-card { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(51, 65, 85, 0.5); }
            .row-item { border-bottom: 1px solid rgba(51, 65, 85, 0.2); }
            textarea { field-sizing: content; min-height: 70px; }
            .ms-text { font-size: 0.7em; opacity: 0.5; margin-left: 1px; }
        </style>
    </head>
    <body class="min-h-screen">
        <div id="desktop-view" class="h-screen flex flex-col items-center justify-center p-10 text-center text-slate-600">
            <h1 class="text-xl font-bold uppercase tracking-widest text-red-500/80">Mobile Terminal Only</h1>
        </div>

        <div id="mobile-view" class="min-h-screen flex flex-col p-4 max-w-md mx-auto">
            <div id="boot-loader" class="flex-1 flex items-center justify-center">
                <div class="text-emerald-500 animate-pulse text-[10px] tracking-[0.5em]">INITIALIZING...</div>
            </div>

            <div id="login-view" class="hidden flex-1 flex flex-col justify-center">
                <div class="text-center mb-10"><span class="text-6xl block mb-4">🌿</span><h1 class="text-4xl font-bold text-emerald-400 glow-text text-center">Letto</h1></div>
                <div class="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-xl">
                    <input type="tel" id="token-input" maxlength="6" placeholder="SYNC CODE" class="w-full bg-slate-900 border border-slate-600 rounded-2xl py-5 text-center text-3xl tracking-[0.3em] focus:outline-none focus:border-emerald-500 mb-5 text-white placeholder:text-slate-800">
                    <button onclick="handleLogin()" class="w-full bg-emerald-600 py-5 rounded-2xl font-bold">IDENTIFY</button>
                </div>
            </div>

            <div id="dashboard-view" class="hidden flex-1 flex flex-col pt-2">
                <header class="flex justify-between items-center mb-6">
                    <div>
                        <h2 class="text-xl font-bold text-white tracking-tighter">Letto 🌿</h2>
                        <div class="text-[8px] font-bold text-slate-600 uppercase tracking-widest">PULSE: <span id="sync-timer">20</span>s</div>
                    </div>
                </header>

                <div class="stat-card p-3 rounded-3xl mb-3 grid grid-cols-3 gap-2">
                    <div class="text-center"><div class="text-[7px] text-slate-500 font-bold mb-1 uppercase text-center">CPU</div><div id="stat-cpu" class="text-xs font-bold text-emerald-400">0%</div></div>
                    <div class="text-center border-x border-white/5"><div class="text-[7px] text-slate-500 font-bold mb-1 uppercase text-center">RAM</div><div id="stat-ram" class="text-xs font-bold text-emerald-400">0%</div></div>
                    <div class="text-center"><div class="text-[7px] text-slate-500 font-bold mb-1 uppercase text-center">DISK</div><div id="stat-disk" class="text-xs font-bold text-emerald-400">0%</div></div>
                </div>

                <!-- Heartbeat Editor -->
                <div class="stat-card rounded-3xl mb-3 overflow-hidden flex flex-col">
                    <div class="bg-white/5 px-4 py-2 flex justify-between items-center">
                        <span class="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Heartbeat Status</span>
                        <div id="hb-last-seen" class="text-[8px] text-slate-500 font-bold uppercase">Never</div>
                    </div>
                    <textarea id="heartbeat-editor" class="w-full bg-transparent p-4 text-[9px] text-slate-300 focus:outline-none resize-none" spellcheck="false" placeholder="Active tasks..."></textarea>
                    <div class="p-2 pt-0 flex justify-end">
                        <button onclick="saveHeartbeat()" class="text-[8px] bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded-xl font-bold uppercase tracking-widest">Save Tasks</button>
                    </div>
                </div>

                <!-- History & info -->
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div class="stat-card rounded-3xl overflow-hidden p-3 text-left">
                        <span class="text-[7px] text-slate-500 uppercase font-bold block mb-2">Agents</span>
                        <div id="agents-list" class="max-h-24 overflow-y-auto"></div>
                    </div>
                    <div class="stat-card rounded-3xl overflow-hidden p-3 text-left">
                        <span class="text-[7px] text-slate-500 uppercase font-bold block mb-2">Git Log</span>
                        <div id="commits-list" class="max-h-24 overflow-y-auto"></div>
                    </div>
                </div>

                <div class="mt-auto py-4 flex justify-between items-center border-t border-white/5 text-[9px] font-bold">
                   <div class="text-slate-500 uppercase">Uptime: <span id="stat-uptime" class="text-white">--H --M</span></div>
                   <button onclick="logout()" class="text-slate-700 uppercase tracking-widest">Deactivate</button>
                </div>
            </div>
        </div>

        <script>
            const authKey = 'letto_auth_token';
            let lastUpdate = Date.now();
            const UPDATE_MS = 20000;

            async function api(path, method = 'GET', body = null) {
                const token = localStorage.getItem(authKey);
                const options = { method, headers: { 'Content-Type': 'application/json' } };
                if (body) options.body = JSON.stringify({ ...body, token });
                else if (token) path += (path.includes('?') ? '&' : '?') + 'token=' + token;
                const res = await fetch(path, options);
                if (res.status === 401 && path !== '/api/auth') logout();
                return res.json();
            }

            async function updateStats() {
                const data = await api('/api/status');
                if (!data) return;
                document.getElementById('stat-cpu').innerText = Math.round(data.cpu) + '%';
                document.getElementById('stat-ram').innerText = Math.round(data.ram) + '%';
                document.getElementById('stat-disk').innerText = Math.round(data.disk) + '%';
                document.getElementById('stat-uptime').innerText = data.uptime;
                
                // Last HB
                const hbSeconds = Math.floor(Date.now()/1000) - data.heartbeat_last;
                const hbText = hbSeconds < 60 ? 'Just now' : `${Math.floor(hbSeconds/60)}m ago`;
                document.getElementById('hb-last-seen').innerText = `Last run: ${hbText}`;

                const agentsList = document.getElementById('agents-list');
                agentsList.innerHTML = '';
                data.agents.forEach(agent => {
                    const row = document.createElement('div');
                    row.className = 'py-1 border-b border-white/5 text-[8px] text-slate-300';
                    row.innerText = agent.name;
                    agentsList.appendChild(row);
                });

                const commitsList = document.getElementById('commits-list');
                commitsList.innerHTML = '';
                data.commits.forEach(c => {
                    const row = document.createElement('div');
                    row.className = 'py-1 border-b border-white/5 text-[7px] text-slate-500 truncate';
                    row.innerText = c.msg;
                    commitsList.appendChild(row);
                });

                if (document.activeElement !== document.getElementById('heartbeat-editor')) {
                    document.getElementById('heartbeat-editor').value = data.heartbeat_raw;
                }
                lastUpdate = Date.now();
            }

            async function saveHeartbeat() {
                const content = document.getElementById('heartbeat-editor').value;
                const res = await api('/api/heartbeat/update', 'POST', { content });
                if (res.success) {
                    const btn = document.querySelector('button[onclick="saveHeartbeat()"]');
                    btn.innerText = 'SAVED';
                    setTimeout(() => btn.innerText = 'SAVE TASKS', 2000);
                }
            }

            function updateTimer() {
                const timerEl = document.getElementById('sync-timer');
                const remaining = Math.max(0, UPDATE_MS - (Date.now() - lastUpdate));
                const seconds = Math.floor(remaining / 1000);
                const ms = remaining % 1000;
                timerEl.innerHTML = `${seconds}<span class="ms-text">.${ms.toString().padStart(3, '0')}</span>`;
            }

            async function handleLogin() {
                const token = document.getElementById('token-input').value;
                const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                if (res.ok) { localStorage.setItem(authKey, token); location.reload(); }
            }

            function logout() { localStorage.removeItem(authKey); location.reload(); }

            window.onload = async () => {
                const savedToken = localStorage.getItem(authKey);
                if (savedToken) {
                    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: savedToken }) });
                    if (res.ok) {
                        document.getElementById('boot-loader').classList.add('hidden');
                        document.getElementById('dashboard-view').classList.remove('hidden');
                        updateStats();
                        setInterval(updateStats, UPDATE_MS);
                        setInterval(updateTimer, 41);
                        return;
                    }
                }
                document.getElementById('boot-loader').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            };
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3000)
