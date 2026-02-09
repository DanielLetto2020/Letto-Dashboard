import os
import psutil
import time
import subprocess
import json
import zipfile
import io

# Manual .env parse to ensure it's loaded BEFORE anything else
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(ENV_PATH):
    with open(ENV_PATH) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k] = v

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Импортируем нашу новую модульную логику
from api.auth import verify_token
from api.system import get_server_uptime, get_last_hb, get_git_info, get_agents_info, get_ai_context, create_backup_zip
from api.heartbeat import get_heartbeat_raw, update_heartbeat_content
from api.files import get_workspace_tree, get_system_config_files, read_file_content
from api.translate import translate_text
from api.cron import get_cron_jobs
from api.projects import get_projects_list
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse

app = FastAPI()

# ... (в конец списка эндпоинтов перед index)
@app.get("/api/system/backup")
async def get_backup(token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    file_obj = create_backup_zip()
    filename = f"letto_backup_{time.strftime('%Y%m%d_%H%M')}.zip"
    return StreamingResponse(
        file_obj, 
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Пути
DASHBOARD_ROOT = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(DASHBOARD_ROOT, "static")), name="static")

class AuthRequest(BaseModel):
    token: str

class HeartbeatUpdate(BaseModel):
    token: str
    content: str

class TranslateRequest(BaseModel):
    token: str
    text: str

@app.post("/api/auth")
async def auth(data: AuthRequest):
    if verify_token(data.token): return {"success": True}
    raise HTTPException(status_code=401)

@app.get("/api/status")
async def get_status(token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    return {
        "cpu": psutil.cpu_percent(),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent,
        "uptime": get_server_uptime(),
        "agents": get_agents_info(),
        "heartbeat_last": get_last_hb(),
        "heartbeat_raw": get_heartbeat_raw(),
        "git": get_git_info(),
        "files": get_workspace_tree(),
        "system_configs": get_system_config_files(),
        "cron": get_cron_jobs()
    }

@app.get("/api/projects")
async def get_projects(token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    return get_projects_list()

@app.get("/api/projects/{name}/download")
async def download_project(name: str, token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    
    workspace_root = os.path.abspath(os.path.join(DASHBOARD_ROOT, "../.."))
    project_path = os.path.join(workspace_root, "projects", name)
    
    project_path = os.path.abspath(project_path) # Normalize the path
    if not project_path.startswith(os.path.abspath(os.path.join(workspace_root, "projects"))):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(project_path) or not os.path.isdir(project_path):
        raise HTTPException(status_code=404, detail="Project not found")

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(project_path):
            for file in files:
                file_full_path = os.path.join(root, file)
                arcname = os.path.relpath(file_full_path, project_path)
                zipf.write(file_full_path, arcname)
    
    memory_file.seek(0)
    return StreamingResponse(
        memory_file,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename={name}.zip"}
    )

# SPA Routing: Fallback for all other routes to index.html
@app.get("/{path:path}")
async def spa_fallback(path: str):
    # If path starts with api/, it's a real 404
    if path.startswith("api/"):
        raise HTTPException(status_code=404)
    # Check if file exists in static (e.g. css/style.css)
    static_file = os.path.join(DASHBOARD_ROOT, "static", path)
    if os.path.exists(static_file) and os.path.isfile(static_file):
        return FileResponse(static_file)
    # Otherwise return SPA index
    return FileResponse(os.path.join(DASHBOARD_ROOT, "static", index_path))

@app.get("/api/ai_status_live")
async def get_ai_status_live(token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    data = get_ai_context()
    if data:
        data["timestamp"] = int(time.time())
        try:
            cache_path = os.path.join(DASHBOARD_ROOT, 'scripts/ai_cache.json')
            with open(cache_path, 'w') as f:
                json.dump(data, f)
        except: pass
        return data
    raise HTTPException(status_code=500, detail="Parser failed")

@app.get("/api/ai_status_cached")
async def get_ai_status_cached(token: str):
    if not verify_token(token): raise HTTPException(status_code=401)
    cache_path = os.path.join(DASHBOARD_ROOT, 'scripts/ai_cache.json')
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                return json.load(f)
        except: pass
    return {"used": 0, "total": 1048576, "percent": 0, "model": "unknown", "timestamp": 0}

@app.post("/api/heartbeat/update")
async def update_heartbeat(data: HeartbeatUpdate):
    if not verify_token(data.token): raise HTTPException(status_code=401)
    update_heartbeat_content(data.content)
    return {"success": True}

@app.get("/api/files/read")
async def get_file(path: str, page: int = 1, token: str = None):
    if not verify_token(token): raise HTTPException(status_code=401)
    return read_file_content(path, page)

@app.post("/api/translate")
async def translate(data: TranslateRequest):
    if not verify_token(data.token): raise HTTPException(status_code=401)
    return {"translated": translate_text(data.text)}

@app.get("/", response_class=HTMLResponse)
@app.get("/agents", response_class=HTMLResponse)
@app.get("/projects", response_class=HTMLResponse)
@app.get("/git", response_class=HTMLResponse)
@app.get("/explorer", response_class=HTMLResponse)
async def index(request: Request):
    return FileResponse(os.path.join(DASHBOARD_ROOT, "static/index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3000)
