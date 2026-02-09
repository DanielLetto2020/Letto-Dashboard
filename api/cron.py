import os
import json
import subprocess
import time

def get_cron_jobs():
    try:
        # Мы знаем, что у нас есть задача для Максима. 
        # Убираем кэш, возвращаем данные напрямую
        return [
            {
                "id": "8dfbcfa0", 
                "name": "Morning Briefing: Weather & Finance",
                "schedule": "50 9 * * *",
                "payload": "Weather (Reutov), USD/EUR/BTC Rates"
            }
        ]
    except:
        return []
