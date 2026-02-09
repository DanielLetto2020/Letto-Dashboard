import os
import json

def get_cron_jobs():
    try:
        cron_path = "/home/max/.openclaw/cron/jobs.json"
        if os.path.exists(cron_path):
            with open(cron_path, 'r') as f:
                data = json.load(f)
                jobs = data.get("jobs", [])
                result = []
                for job in jobs:
                    result.append({
                        "id": job.get("id", "unk")[:8],
                        "name": job.get("name", "Unnamed"),
                        "schedule": job.get("schedule", {}).get("expr", "at once"),
                        "payload": str(job.get("payload", {}).get("message", "Agent Turn"))
                    })
                return result
    except Exception as e:
        print(f"Cron parse error: {e}")
    return []
