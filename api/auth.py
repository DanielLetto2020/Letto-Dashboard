import os
import json
from datetime import datetime

DASHBOARD_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILE = os.path.join(DASHBOARD_ROOT, 'scripts/tokens.json')

def verify_token(token: str):
    if not os.path.exists(TOKEN_FILE):
        return False
    with open(TOKEN_FILE, 'r') as f:
        stored = json.load(f)
    return stored['token'] == token and datetime.now().timestamp() < stored['expires_at']
