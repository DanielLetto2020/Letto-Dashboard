# Letto Dashboard Core Map 🌿

Карта архитектуры для предотвращения деградации кода при обновлении.

**Current Version: v1.0.0 Stable** 🏷️

## 🏗 Архитектура
- **Backend**: FastAPI (Python 3.12)
- **Frontend**: Single HTML (SPA-ish) на Tailwind CSS 3.x
- **Auth**: 6-digit token (expire at 00:00 GMT+3), stored in `scripts/tokens.json`
- **Database**: Files-based (JSON/MD)

## 📡 API Endpoints
- `POST /api/auth`: Проверка токена.
- `GET /api/status?token=XXX`: Сбор CPU, RAM, Disk, Uptime, Agents, Heartbeat и Git.
- `POST /api/heartbeat/update`: Запись в `HEARTBEAT.md`.
- `GET /api/files/read`: Чтение файлов (1MB chunks).
- `POST /api/translate`: Перевод текста (via deep-translator).
