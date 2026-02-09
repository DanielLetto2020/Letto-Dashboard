import random
import json
import os
from datetime import datetime, time, timedelta

TOKEN_FILE = os.path.join(os.path.dirname(__file__), 'tokens.json')

def get_midnight():
    now = datetime.now()
    midnight = datetime.combine(now.date() + timedelta(days=1), time.min)
    return midnight.timestamp()

def generate_token():
    # Генерируем 6-значный цифровой код
    token = str(random.randint(100000, 999999))
    expiry = get_midnight()
    
    data = {
        "token": token,
        "expires_at": expiry,
        "created_at": datetime.now().isoformat()
    }
    
    with open(TOKEN_FILE, 'w') as f:
        json.dump(data, f)
    
    return token

def verify_token(token):
    if not os.path.exists(TOKEN_FILE):
        return False
    
    with open(TOKEN_FILE, 'r') as f:
        data = json.load(f)
    
    # Проверка самого токена
    if data['token'] != str(token):
        return False
        
    # Проверка времени (до 00:00)
    if datetime.now().timestamp() > data['expires_at']:
        return False
        
    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == "--gen":
            print(generate_token())
        elif sys.argv[1] == "--verify":
            print(verify_token(sys.argv[2]))
