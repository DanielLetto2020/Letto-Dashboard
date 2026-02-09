import os

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_workspace_tree(path=None):
    if path is None:
        path = WORKSPACE_ROOT
    
    tree = []
    try:
        if not os.path.exists(path): return []
        items = sorted(os.listdir(path))
        for item in items:
            if item.startswith('.') or item in ["__pycache__", "node_modules"]:
                if item != ".env": continue # .env в воркспейсе полезен
                
            full_path = os.path.join(path, item)
            is_dir = os.path.isdir(full_path)
            
            node = {
                "name": item,
                "is_dir": is_dir,
                "path": os.path.relpath(full_path, WORKSPACE_ROOT)
            }
            
            if is_dir:
                try:
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
            result.append({
                "name": f,
                "path": full_path,
                "is_dir": False
            })
    return result

def read_file_content(path, page=1):
    # Теперь умеем читать и относительные (проект) и абсолютные (система) пути
    full_path = path if path.startswith("/") else os.path.join(WORKSPACE_ROOT, path)
    
    if not full_path.startswith("/home/max/.openclaw"):
        return {"error": "Access denied"}

    if not os.path.exists(full_path) or os.path.isdir(full_path):
        return {"error": "File not found"}
    
    # 1MB limit per chunk
    CHUNK_SIZE = 1024 * 1024 
    file_size = os.path.getsize(full_path)
    
    try:
        with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
            f.seek((page - 1) * CHUNK_SIZE)
            content = f.read(CHUNK_SIZE)
            
        return {
            "name": os.path.basename(path),
            "content": content,
            "size": file_size,
            "page": page,
            "total_pages": (file_size // CHUNK_SIZE) + (1 if file_size % CHUNK_SIZE > 0 else 0)
        }
    except Exception as e:
        return {"error": str(e)}
