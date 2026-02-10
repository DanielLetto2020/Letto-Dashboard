import os
import subprocess
import datetime

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
                # 1. Проверяем наличие .git
                git_dir = os.path.join(full_path, ".git")
                has_git = os.path.exists(git_dir)
                
                # 2. Получаем Remote URL
                remote_url = None
                if has_git:
                    try:
                        remote_url = subprocess.check_output(
                            ["git", "remote", "get-url", "origin"],
                            cwd=full_path, text=True, stderr=subprocess.DEVNULL
                        ).strip()
                    except:
                        remote_url = "No remote origin"

                # 3. Базовая инфа
                projects.append({
                    "name": item,
                    "path": full_path,
                    "has_git": has_git,
                    "remote_url": remote_url
                })
    except Exception as e:
        print(f"Error in get_projects_list: {e}")
        
    return projects
