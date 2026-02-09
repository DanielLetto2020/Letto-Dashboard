import os
import psutil
import time
import subprocess
import json
from api.parser import get_latest_context

# Константы путей относительно этого файла
API_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_ROOT = os.path.dirname(API_DIR)
# Воркспейс всегда в одном и том же месте
WORKSPACE_ROOT = "/home/max/.openclaw/workspace"
HB_MARKER = os.path.join(WORKSPACE_ROOT, '.heartbeat_last_run')

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
        # Дашборд теперь в projects/dashboard
        branch = subprocess.check_output(f"git -C {DASHBOARD_ROOT} rev-parse --abbrev-ref HEAD", shell=True).decode().strip()
        output = subprocess.check_output(f"git -C {DASHBOARD_ROOT} log -5 --pretty=format:'%s@@%ar'", shell=True).decode().splitlines()
        commits = [{"msg": l.split("@@")[0], "date": l.split("@@")[1]} for l in output if "@@" in l]
        return {"branch": branch, "commits": commits}
    except: 
        return {"branch": "unknown", "commits": []}

def get_ai_context():
    return get_latest_context()

def create_backup_zip():
    import zipfile
    from io import BytesIO
    memory_file = BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        # 1. Добавляем воркспейс
        for root, dirs, files in os.walk(WORKSPACE_ROOT):
            if any(x in root for x in ['node_modules', '.git', '__pycache__']):
                continue
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.join('workspace', os.path.relpath(full_path, WORKSPACE_ROOT))
                zf.write(full_path, rel_path)
        
        # 2. Добавляем системные конфиги
        SYSTEM_ROOT = "/home/max/.openclaw"
        sys_files = [
            'openclaw.json', 'openclaw.json.bak', '.env', 
            'agents/main/sessions/sessions.json'
        ]
        for f in sys_files:
            f_path = os.path.join(SYSTEM_ROOT, f)
            if os.path.exists(f_path):
                zf.write(f_path, os.path.join('system_configs', f))
                
    memory_file.seek(0)
    return memory_file

def get_agents_info():
    agents = []
    try:
        cmd = "ps aux | grep -v grep | grep -E 'python3.*server.py|openclaw|node.*index.mjs'"
        output = subprocess.check_output(cmd, shell=True).decode().splitlines()
        for line in output:
            line = line.strip()
            if not line: continue
            parts = line.split()
            if len(parts) < 11: continue
            pid = parts[1]
            cmd_full = " ".join(parts[10:])
            if "server.py" in cmd_full: name = "Letto UI Manager"
            elif "openclaw-gateway" in cmd_full: name = "Letto Core Gateway"
            elif "node" in cmd_full and "index.mjs" in cmd_full: name = "Active Session"
            else: name = "Active Process"
            if not any(a['name'] == name for a in agents):
                agents.append({"pid": pid, "name": name})
    except: pass
    if not agents: agents.append({"pid": str(os.getpid()), "name": "Letto UI Manager (Self)"})
    return agents
