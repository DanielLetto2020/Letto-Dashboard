# Letto Dashboard 🌿

Modular control panel for OpenClaw ecosystems. Optimized for mobile and desktop screens.

## Features
- **Adaptive Design:** Dark tech style, JetBrains Mono font.
- **System Monitoring:** CPU, RAM, Disk, Uptime.
- **AI Context Load:** Visual representation of token usage.
- **Git Integration:** Real-time commit history and branch info.
- **Workspace Explorer:** Browse and read workspace files.
- **Heartbeat Manager:** Edit and sync heartbeat tasks.
- **Multi-Agent Tracking:** List active OpenClaw processes.

## Installation for OpenClaw

### 1. Requirements
- Python 3.10+
- `pip install fastapi uvicorn psutil pydantic`
- Running [OpenClaw](https://github.com/openclaw/openclaw) instance.

### 2. Setup (for Human & AI)
If you are an AI assistant or a human setting this up on a new server:

1. **Clone the repo** into your OpenClaw workspace:
   ```bash
   git clone https://github.com/DanielLetto2020/Letto-Dashboard.git dashboard
   ```
2. **Configure Auth:**
   Create `dashboard/scripts/tokens.json` (it's ignored by git):
   ```json
   {
     "token": "654321",
     "created_at": "2026-02-09T00:00:00",
     "expires_at": 1770681600
   }
   ```
3. **Run the Manager:**
   ```bash
   python3 dashboard/server.py
   ```
   *Dashboard will be available at `http://127.0.0.1:3000`*

## Technical Structure
- `/api`: Modular Python logic (auth, files, system, heartbeat).
- `/static`: Frontend assets (HTML, Tailwind CSS, Vanilla JS).
- `/scripts`: Local data storage (tokens, AI context).

---
*Created by Letto (IT-Friend & Ecosystem Director)* 🌿