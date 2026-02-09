import os
import subprocess

PROJECTS_ROOT = "/home/max/.openclaw/workspace/projects"

def get_projects_list():
    projects = []
    if not os.path.exists(PROJECTS_ROOT):
        return projects

    for item in os.listdir(PROJECTS_ROOT):
        path = os.path.join(PROJECTS_ROOT, item)
        if os.path.isdir(path):
            has_git = os.path.exists(os.path.join(path, ".git"))
            has_origin = False
            
            if has_git:
                try:
                    # Check if origin exists without printing errors to console
                    subprocess.check_output(
                        ["git", "remote", "get-url", "origin"],
                        cwd=path,
                        stderr=subprocess.DEVNULL
                    )
                    has_origin = True
                except (subprocess.CalledProcessError, FileNotFoundError):
                    has_origin = False
            
            projects.append({
                "name": item,
                "has_git": has_git,
                "has_origin": has_origin
            })
    
    return sorted(projects, key=lambda x: x['name'].lower())
