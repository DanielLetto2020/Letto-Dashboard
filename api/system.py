import os
import psutil
import time
import subprocess
import json
import zipfile
import io

# Корень проекта для гит-команд
DASHBOARD_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_server_uptime():
    uptime_seconds = time.time() - psutil.boot_time()
    hours = int(uptime_seconds // 3600)
    minutes = int((uptime_seconds % 3600) // 60)
    return f"{hours}h {minutes}m"

def get_last_hb():
    try:
        hb_path = "/home/max/.openclaw/workspace/memory/heartbeat-state.json"
        if os.path.exists(hb_path):
            return os.path.getmtime(hb_path)
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
    except:
        return {"branch": "unknown", "commits": []}

def sync_to_dev():
    """
    Автоматизация: переключение на dev, merge текущей ветки, push origin dev.
    """
    try:
        # 0. Убеждаемся, что мы в правильной папке
        if not os.path.exists(os.path.join(DASHBOARD_ROOT, ".git")):
            return {"success": False, "message": f"Git repo not found in {DASHBOARD_ROOT}"}

        # 1. Получаем текущую ветку
        current_branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], 
                                               text=True, cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT).strip()
        
        # 2. АВТО-КОММИТ: Забираем все изменения перед синхронизацией
        # Проверяем, есть ли что коммитить
        status = subprocess.check_output(["git", "status", "--porcelain"], cwd=DASHBOARD_ROOT, text=True).strip()
        if status:
            subprocess.check_output(["git", "add", "."], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
            subprocess.check_output(["git", "commit", "-m", f"auto: task completed on {current_branch}"], 
                                   cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)

        if current_branch == 'dev':
            subprocess.check_output(["git", "push", "origin", "dev"], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
            return {"success": True, "message": "Changes committed and pushed to dev."}

        # 3. Переключаемся на dev (сначала fetch для актуальности)
        subprocess.check_output(["git", "fetch", "origin"], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
        subprocess.check_output(["git", "checkout", "dev"], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
        
        # 3. Вливаем рабочую ветку
        subprocess.check_output(["git", "merge", current_branch], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
        
        # 4. Пушим
        subprocess.check_output(["git", "push", "origin", "dev"], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
        
        # 5. Возвращаемся назад
        subprocess.check_output(["git", "checkout", current_branch], cwd=DASHBOARD_ROOT, stderr=subprocess.STDOUT)
        
        return {"success": True, "message": f"Merged {current_branch} into dev and pushed successfully."}
    except subprocess.CalledProcessError as e:
        error_msg = e.output if hasattr(e, 'output') else str(e)
        return {"success": False, "message": f"Git command failed: {error_msg}"}
    except Exception as e:
        return {"success": False, "message": f"Unexpected error: {str(e)}"}

def get_agents_info():
    agents = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = " ".join(proc.info['cmdline'] or [])
            if 'openclaw-gateway' in cmd:
                agents.append({"pid": str(proc.info['pid']), "name": "Letto Core Gateway"})
            elif 'server.py' in cmd:
                agents.append({"pid": str(proc.info['pid']), "name": "Letto UI Manager"})
        except: pass
    return agents

def get_ai_context():
    try:
        cli_path = "/home/max/.nvm/versions/node/v22.22.0/bin/openclaw"
        result = subprocess.run([cli_path, "sessions", "list"], capture_output=True, text=True, check=True)
        try:
            sessions = json.loads(result.stdout)
            main_session = next((s for s in sessions if "main" in s.get("key", "")), sessions[0])
            return {
                "used": main_session.get("totalTokens", 0),
                "total": main_session.get("contextTokens", 1048576),
                "percent": round((main_session.get("totalTokens", 0) / main_session.get("contextTokens", 1048576)) * 100, 1),
                "model": main_session.get("model", "unknown")
            }
        except:
            return get_ai_context_legacy()
    except Exception as e:
        print(f"CLI Parser Error: {e}")
        return get_ai_context_legacy()

def get_ai_context_legacy():
    try:
        path = "/home/max/.openclaw/agents/main/sessions/sessions.json"
        if os.path.exists(path):
            with open(path, 'r') as f:
                data = json.load(f)
                main = data[0] if isinstance(data, list) else data.get('agent:main:main', {})
                tokens = main.get('totalTokens', 0)
                limit = main.get('contextTokens', 1048576)
                return {
                    "used": tokens,
                    "total": limit,
                    "percent": round((tokens / limit) * 100, 1) if limit > 0 else 0,
                    "model": main.get('model', 'unknown')
                }
    except Exception as e:
        print(f"Legacy Parser Error: {e}")
    return {"used": 0, "total": 1048576, "percent": 0, "model": "error", "timestamp": 0}

def create_backup_zip():
    memory_file = io.BytesIO()
    workspace_root = "/home/max/.openclaw/workspace"
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(workspace_root):
            if 'node_modules' in dirs: dirs.remove('node_modules')
            if '.git' in dirs: dirs.remove('.git')
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, workspace_root)
                zipf.write(file_path, arcname)
        
        sys_paths = ["/home/max/.openclaw/openclaw.json", "/home/max/.openclaw/agents/main/sessions/sessions.json"]
        for p in sys_paths:
            if os.path.exists(p):
                zipf.write(p, "system/" + os.path.basename(p))
                
    memory_file.seek(0)
    return memory_file
