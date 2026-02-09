import os
import subprocess
import re

def get_latest_context():
    try:
        # Прямой вызов CLI — самый надежный способ получить то, что видит человек в консоли
        # Используем --limit 1 чтобы найти только основную активную сессию
        output = subprocess.check_output("openclaw sessions list", shell=True).decode('utf-8', errors='ignore')
        
        # Ищем строку с главной сессией: agent:main:main
        lines = output.splitlines()
        for line in lines:
            if "agent:main:main" in line:
                # Извлекаем модель и токены
                # Формат: direct agent:main:main 1m ago google/... 486k/1049k (46%)
                match = re.search(r"(\S+)\s+([\d\.]+[km]?)\s*/\s*([\d\.]+[km]?)\s*\(([\d\.]+)%\)", line)
                if match:
                    model_path, used_str, limit_str, percent_str = match.groups()
                    
                    def to_num(s):
                        s = s.lower().replace(' ', '')
                        if 'k' in s: return int(float(s.replace('k','')) * 1000)
                        if 'm' in s: return int(float(s.replace('m','')) * 1000000)
                        return int(float(s))
                    
                    return {
                        "used": to_num(used_str),
                        "total": to_num(limit_str),
                        "percent": int(float(percent_str)),
                        "model": model_path.split('/')[-1]
                    }
        
        # Если главная сессия не найдена (редко), берем первую с Kind direct
        for line in lines:
            if "direct" in line:
                match = re.search(r"(\S+)\s+([\d\.]+[km]?)\s*/\s*([\d\.]+[km]?)\s*\(([\d\.]+)%\)", line)
                if match:
                    model_path, used_str, limit_str, percent_str = match.groups()
                    return {
                        "used": to_num(used_str),
                        "total": to_num(limit_str),
                        "percent": int(float(percent_str)),
                        "model": model_path.split('/')[-1]
                    }
    except Exception as e:
        print(f"CLI Parser Error: {e}")
    
    return None
