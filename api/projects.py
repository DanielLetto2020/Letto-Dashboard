import os
import datetime
import subprocess

PROJECTS_ROOT = "/home/max/.openclaw/workspace/projects"

def get_projects_list():
    if not os.path.exists(PROJECTS_ROOT):
        return []
    
    projects = []
    try:
        items = sorted(os.listdir(PROJECTS_ROOT))
        for item in items:
            full_path = os.path.join(PROJECTS_ROOT, item)
            if os.path.isdir(full_path):
                # Проверка наличия локального Git
                has_git = os.path.exists(os.path.join(full_path, ".git"))
                origin_url = None
                
                if has_git:
                    try:
                        # Пытаемся получить URL удаленного репозитория
                        origin_url = subprocess.check_output(
                            ["git", "remote", "get-url", "origin"],
                            cwd=full_path,
                            stderr=subprocess.STDOUT
                        ).decode('utf-8').strip()
                    except:
                        origin_url = None

                # Базовая инфа о проекте
                proj_files = []
                try:
                    for f in sorted(os.listdir(full_path)):
                        if f.startswith('.') or f == "__pycache__": continue
                        f_path = os.path.join(full_path, f)
                        
                        size = 0
                        mtime = "Unknown"
                        try:
                            stats = os.stat(f_path)
                            size = stats.st_size
                            mtime = datetime.datetime.fromtimestamp(stats.st_mtime).strftime('%Y-%m-%d %H:%M')
                        except: pass

                        proj_files.append({
                            "name": f,
                            "is_dir": os.path.isdir(f_path),
                            "path": f, # Относительно корня проекта
                            "size": size,
                            "mtime": mtime
                        })
                except: pass
                
                projects.append({
                    "name": item,
                    "path": full_path,
                    "has_git": has_git,
                    "origin": origin_url,
                    "files": proj_files
                })
    except Exception as e:
        print(f"Error listing projects: {e}")
        
    return projects
