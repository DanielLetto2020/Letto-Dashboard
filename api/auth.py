import os
import json
from datetime import datetime

DASHBOARD_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILE = os.path.join(DASHBOARD_ROOT, 'scripts/tokens.json')

def verify_token(token: str):
    # 1. Сначала проверяем мастер-ключ из окружения (простой и быстрый способ)
    master_key = os.getenv('MASTER_KEY')
    if master_key and token == master_key:
        return True

    # 2. Если не мастер-ключ, проверяем разовый токен из файла
    if not os.path.exists(TOKEN_FILE):
        return False
        
    try:
        with open(TOKEN_FILE, 'r') as f:
            stored = json.load(f)
        return stored['token'] == token and datetime.now().timestamp() < stored['expires_at']
    except:
        return False
