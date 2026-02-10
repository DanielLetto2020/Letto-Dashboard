import os
import psutil
import time
import subprocess
import json
import zipfile
import io
import requests

# Корень проекта для гит-команд
DASHBOARD_ROOT = "/home/max/.openclaw/workspace/projects/dashboard"

def get_server_uptime():
    try:
        uptime_seconds = time.time() - psutil.boot_time()
        return f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m"
    except: return "--h --m"

def get_last_hb():
    try:
        hb_path = "/home/max/.openclaw/workspace/memory/heartbeat-state.json"
        if os.path.exists(hb_path): return os.path.getmtime(hb_path)
    except: pass
    return int(time.time())

def get_git_info():
    try:
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True, cwd=DASHBOARD_ROOT).strip()
        commits_raw = subprocess.check_output(["git", "log", "-n", "5", "--pretty=format:%s|%cr"], text=True, cwd=DASHBOARD_ROOT).strip()
        commits = []
        for line in commits_raw.split('\n'):
            if '|' in line:
                msg, date = line.split('|')
                commits.append({"msg": msg, "date": date})
        return {"branch": branch, "commits": commits}
    except: return {"branch": "unknown", "commits": []}

def sync_to_dev():
    """
    CI/CD Конвейер: Commit -> Sync Master -> Merge to Dev -> Push -> Create PR
    """
    try:
        # Текущая ветка
        current_branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], 
                                               text=True, cwd=DASHBOARD_ROOT).strip()
        
        # 1. COMMIT: Сохраняем текущий прогресс
        subprocess.run(["git", "add", "."], cwd=DASHBOARD_ROOT)
        subprocess.run(["git", "commit", "-m", f"auto: task progress on {current_branch}"], 
                       cwd=DASHBOARD_ROOT, capture_output=True)

        # 2. FETCH ALL
        subprocess.run(["git", "fetch", "--all"], cwd=DASHBOARD_ROOT, capture_output=True)

        # 3. MASTER UPDATE
        subprocess.run(["git", "checkout", "master"], cwd=DASHBOARD_ROOT, check=True, capture_output=True)
        subprocess.run(["git", "pull", "origin", "master"], cwd=DASHBOARD_ROOT, capture_output=True)

        # 4. DEV UPDATE & MERGE
        subprocess.run(["git", "checkout", "dev"], cwd=DASHBOARD_ROOT, check=True, capture_output=True)
        subprocess.run(["git", "pull", "origin", "dev"], cwd=DASHBOARD_ROOT, capture_output=True)
        subprocess.run(["git", "merge", "master"], cwd=DASHBOARD_ROOT, capture_output=True)
        subprocess.run(["git", "merge", current_branch], cwd=DASHBOARD_ROOT, capture_output=True)

        # 5. PUSH DEV
        subprocess.run(["git", "push", "origin", "dev"], cwd=DASHBOARD_ROOT, check=True, capture_output=True)

        # Назад к задаче
        subprocess.run(["git", "checkout", current_branch], cwd=DASHBOARD_ROOT, capture_output=True)
        
        return {"success": True, "message": "All branches synced and pushed to origin/dev."}

    except Exception as e:
        return {"success": False, "message": f"Sync failed: {str(e)}"}

def get_agents_info():
    agents = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = " ".join(proc.info['cmdline'] or [])
            if 'openclaw-gateway' in cmd: agents.append({"pid": str(proc.info['pid']), "name": "Letto Core Gateway"})
            elif 'server.py' in cmd: agents.append({"pid": str(proc.info['pid']), "name": "Letto UI Manager"})
        except: pass
    return agents

def get_ai_context():
    try:
        cli_path = "/home/max/.nvm/versions/node/v22.22.0/bin/openclaw"
        result = subprocess.run([cli_path, "sessions", "list"], capture_output=True, text=True, check=True)
        sessions = json.loads(result.stdout)
        main = next((s for s in sessions if "main" in s.get("key", "")), sessions[0])
        return {"used": main.get("totalTokens", 0), "total": 1048576, "percent": round((main.get("totalTokens", 0)/1048576)*100,1), "model": main.get("model", "unknown")}
    except: return {"used": 0, "total": 1048576, "percent": 0, "model": "unknown"}

def create_backup_zip():
    memory_file = io.BytesIO()
    workspace_root = "/home/max/.openclaw/workspace"
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(workspace_root):
            if 'node_modules' in dirs or '.git' in dirs: continue
            for file in files:
                fpath = os.path.join(root, file)
                zipf.write(fpath, os.path.relpath(fpath, workspace_root))
    memory_file.seek(0)
    return memory_file
