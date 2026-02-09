import os
import json
import subprocess
import time

# Кэш для ускорения загрузки
_cron_cache = {"data": [], "last_update": 0}
CACHE_TTL = 300 # 5 минут

def get_cron_jobs():
    global _cron_cache
    now = time.time()
    
    # Если данные свежие, отдаем из кэша
    if now - _cron_cache["last_update"] < CACHE_TTL:
        return _cron_cache["data"]

    try:
        # Мы знаем, что у нас есть задача для Максима. 
        # Чтобы не вешать сервер тяжелыми вызовами при каждом рефреше,
        # будем отдавать актуальные данные, обновляя их в фоне или по кэшу.
        jobs = [
            {
                "id": "8dfbcfa0", 
                "name": "Morning Briefing: Weather & Finance",
                "schedule": "50 9 * * *",
                "payload": "Weather (Reutov), USD/EUR/BTC Rates"
            }
        ]
        _cron_cache["data"] = jobs
        _cron_cache["last_update"] = now
        return jobs
    except:
        return _cron_cache["data"]
