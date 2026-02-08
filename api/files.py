import os

# Путь к воркспейсу (на 2 уровня выше api/)
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_workspace_tree(path=None):
    if path is None:
        path = WORKSPACE_ROOT
    
    tree = []
    try:
        # Получаем список файлов и папок, игнорируем скрытые и __pycache__
        items = sorted(os.listdir(path))
        for item in items:
            if item.startswith('.') or item == "__pycache__":
                continue
                
            full_path = os.path.join(path, item)
            is_dir = os.path.isdir(full_path)
            
            node = {
                "name": item,
                "is_dir": is_dir,
                "path": os.path.relpath(full_path, WORKSPACE_ROOT)
            }
            
            # Если папка — получаем её содержимое (на один уровень вглубь для начала)
            if is_dir:
                try:
                    node["children"] = get_workspace_tree(full_path)
                except:
                    node["children"] = []
                    
            tree.append(node)
    except Exception as e:
        print(f"Error reading tree: {e}")
        
    return tree
