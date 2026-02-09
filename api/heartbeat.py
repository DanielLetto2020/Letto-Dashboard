import os

WORKSPACE_ROOT = "/home/max/.openclaw/workspace"
HEARTBEAT_FILE = os.path.join(WORKSPACE_ROOT, 'HEARTBEAT.md')

def get_heartbeat_raw():
    if os.path.exists(HEARTBEAT_FILE):
        try:
            with open(HEARTBEAT_FILE, 'r') as f:
                return f.read()
        except:
            return "Error reading file"
    return f"File not found at {HEARTBEAT_FILE}"

def update_heartbeat_content(content: str):
    try:
        with open(HEARTBEAT_FILE, 'w') as f:
            f.write(content)
        return True
    except:
        return False
