from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import psutil

# Импортируем нашу новую модульную логику
from api.auth import verify_token
from api.system import get_server_uptime, get_last_hb, get_git_info, get_agents_info
from api.heartbeat import get_heartbeat_raw, update_heartbeat_content
from api.files import get_workspace_tree, read_file_content
from api.translate import translate_text

app = FastAPI()

# Монтируем статику (JS, CSS)
current_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(current_dir, "static")), name="static")

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
    git_info = get_git_info()
    return {
        "cpu": psutil.cpu_percent(),
        "ram": psutil.virtual_memory().percent,
        "disk": psutil.disk_usage('/').percent,
        "uptime": get_server_uptime(),
        "agents": get_agents_info(),
        "heartbeat_last": get_last_hb(),
        "heartbeat_raw": get_heartbeat_raw(),
        "git": git_info,
        "files": get_workspace_tree()
    }

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
async def index():
    # Отдаем главный HTML из файла
    return FileResponse(os.path.join(current_dir, "static/index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3000)
