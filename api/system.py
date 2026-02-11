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
        
        # Получаем список всех веток
        branches_raw = subprocess.check_output(["git", "branch", "--format=%(refname:short)"], text=True, cwd=DASHBOARD_ROOT).strip()
        branches = branches_raw.split('\n')
        
        return {"branch": branch, "commits": commits, "branches": branches}
    except: return {"branch": "unknown", "commits": [], "branches": []}

def git_checkout_branch(branch_name: str):
    try:
        # Проверяем, нет ли незакоммиченных изменений (опционально, но лучше сделать)
        # Для простоты просто делаем checkout
        subprocess.run(["git", "checkout", branch_name], cwd=DASHBOARD_ROOT, check=True, capture_output=True)
        return {"success": True, "message": f"Switched to branch {branch_name}"}
    except Exception as e:
        return {"success": False, "message": f"Checkout failed: {str(e)}"}

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

        # 6. GITHUB PR: Создаем Pull Request (dev -> master)
        pr_message = "All branches synced and pushed to origin/dev."
        try:
            remote_url = subprocess.check_output(["git", "remote", "get-url", "origin"], text=True, cwd=DASHBOARD_ROOT).strip()
            if "github_pat_" in remote_url:
                token = remote_url.split('@')[0].split(':')[-1]
                repo_path = remote_url.split('github.com/')[-1].replace('.git', '')
                
                api_url = f"https://api.github.com/repos/{repo_path}/pulls"
                headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
                payload = {
                    "title": f"Release: {current_branch} merge",
                    "head": "dev",
                    "base": "master",
                    "body": f"Automatically merged {current_branch} into dev. Syncing with master."
                }
                response = requests.post(api_url, headers=headers, json=payload)
                if response.status_code == 201:
                    pr_message = f"Pushed & PR created: {response.json().get('html_url')}"
                elif response.status_code == 422:
                    pr_message = "Pushed. PR already exists."
                else: pr_message = f"Pushed, but PR error: {response.status_code}"
        except: pass

        # Назад к задаче
        subprocess.run(["git", "checkout", current_branch], cwd=DASHBOARD_ROOT, capture_output=True)
        
        return {"success": True, "message": pr_message}

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
