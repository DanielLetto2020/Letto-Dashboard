import os

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HEARTBEAT_FILE = os.path.join(WORKSPACE_ROOT, 'HEARTBEAT.md')

def get_heartbeat_raw():
    if os.path.exists(HEARTBEAT_FILE):
        with open(HEARTBEAT_FILE, 'r') as f:
            return f.read()
    return ""

def update_heartbeat_content(content: str):
    with open(HEARTBEAT_FILE, 'w') as f:
        f.write(content)
    return True
