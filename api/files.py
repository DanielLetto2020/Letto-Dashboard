import os
import time

# Путь к воркспейсу теперь на один уровень выше, так как дашборд переехал в projects/
WORKSPACE_ROOT = "/home/max/.openclaw/workspace"
# Корень дашборда для относительных путей внутри него
DASHBOARD_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_workspace_tree(path=None):
    if path is None:
        path = WORKSPACE_ROOT
    
    tree = []
    try:
        if not os.path.exists(path): return []
        items = sorted(os.listdir(path))
        for item in items:
            if item.startswith('.') and item != ".env": continue
            if item in ["__pycache__", "node_modules"]: continue
                
            full_path = os.path.join(path, item)
            is_dir = os.path.isdir(full_path)
            
            size = 0
            mtime = 0
            try:
                stats = os.stat(full_path)
                size = stats.st_size
                mtime = stats.st_mtime
            except Exception:
                pass

            node = {
                "name": item,
                "is_dir": is_dir,
                "path": os.path.relpath(full_path, WORKSPACE_ROOT),
                "size": size,
                "mtime": mtime
            }
            
            if is_dir:
                try:
                    # Ограничиваем рекурсию для стабильности
                    node["children"] = get_workspace_tree(full_path)
                except:
                    node["children"] = []
                    
            tree.append(node)
    except Exception as e:
        print(f"Error reading tree: {e}")
        
    return tree

def get_system_config_files():
    base = "/home/max/.openclaw"
    files = [
        "openclaw.json",
        "openclaw.json.bak",
        "update-check.json",
        "agents/main/sessions/sessions.json",
        "agents/main/agent/auth-profiles.json",
        "telegram/update-offset-default.json"
    ]
    result = []
    for f in files:
        full_path = os.path.join(base, f)
        if os.path.exists(full_path):
            try:
                stats = os.stat(full_path)
                result.append({
                    "name": f,
                    "path": full_path,
                    "is_dir": False,
                    "size": stats.st_size,
                    "mtime": stats.st_mtime
                })
            except:
                continue
    return result

def read_file_content(path, page=1):
    # Пытаемся понять, это абсолютный путь (система) или относительный (воркспейс)
    if path.startswith("/home/max/.openclaw"):
        full_path = path
    else:
        full_path = os.path.join(WORKSPACE_ROOT, path)
    
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        return {"error": "File not found"}
    
    CHUNK_SIZE = 1024 * 1024 
    file_size = os.path.getsize(full_path)
    
    try:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            f.seek((page - 1) * CHUNK_SIZE)
            content = f.read(CHUNK_SIZE)
            
        return {
            "name": os.path.basename(full_path),
            "content": content,
            "size": file_size,
            "page": page,
            "total_pages": (file_size // CHUNK_SIZE) + (1 if file_size % CHUNK_SIZE > 0 else 0)
        }
    except Exception as e:
        return {"error": str(e)}
