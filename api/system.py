import os
import psutil
import time
import subprocess
import json

# Константы путей
API_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_ROOT = os.path.dirname(API_DIR)
WORKSPACE_ROOT = os.path.dirname(DASHBOARD_ROOT)
HB_MARKER = os.path.join(WORKSPACE_ROOT, '.heartbeat_last_run')
AI_CONTEXT_FILE = os.path.join(DASHBOARD_ROOT, 'scripts/ai_context.json')

def get_server_uptime():
    lib_boot_time = psutil.boot_time()
    uptime_seconds = int(time.time() - lib_boot_time)
    return f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m"

def get_last_hb():
    if os.path.exists(HB_MARKER):
        return int(os.path.getmtime(HB_MARKER))
    return int(time.time())

def get_git_info():
    try:
        branch = subprocess.check_output(f"git -C {DASHBOARD_ROOT} rev-parse --abbrev-ref HEAD", shell=True).decode().strip()
        output = subprocess.check_output(f"git -C {DASHBOARD_ROOT} log -5 --pretty=format:'%s|%ar'", shell=True).decode().splitlines()
        commits = [{"msg": l.split("|")[0], "date": l.split("|")[1]} for l in output if "|" in l]
        return {"branch": branch, "commits": commits}
    except: 
        return {"branch": "unknown", "commits": []}

def get_ai_context():
    try:
        if os.path.exists(AI_CONTEXT_FILE):
            with open(AI_CONTEXT_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"AI Context read error: {e}")
    return {"used": 0, "total": 1000000, "percent": 0}

def get_agents_info():
    agents = []
    try:
        cmd = "ps -eo pid,cmd | grep -E 'openclaw|node.*index.mjs|python3.*server.py' | grep -v grep"
        output = subprocess.check_output(cmd, shell=True).decode().splitlines()
        for line in output:
            line = line.strip()
            if not line: continue
            parts = line.split()
            pid = parts[0]
            cmd_full = " ".join(parts[1:])
            if "server.py" in cmd_full: name = "Letto UI Manager"
            elif "openclaw" in cmd_full and "gateway" in cmd_full: name = "Letto Core Gateway"
            elif "node" in cmd_full and "index.mjs" in cmd_full: name = "Main Session"
            else: name = "Active Process"
            agents.append({"pid": pid, "name": name})
    except: pass
    if not agents: agents.append({"pid": str(os.getpid()), "name": "Letto UI Manager (Self)"})
    return agents
