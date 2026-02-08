# Letto Dashboard Core Map 🌿

Карта архитектуры для предотвращения деградации кода при обновлении.

## 🏗 Архитектура
- **Backend**: FastAPI (Python 3.12)
- **Frontend**: Single HTML (SPA-ish) на Tailwind CSS 3.x
- **Auth**: 6-digit token (expire at 00:00 GMT+3), stored in `scripts/tokens.json`
- **Database**: Files-based (JSON/MD)

## 📡 API Endpoints
- `POST /api/auth`: Проверка токена.
- `GET /api/status?token=XXX`: Сбор CPU, RAM, Disk, Uptime, Agents и Heartbeat.
- `POST /api/heartbeat/update`: Запись в `HEARTBEAT.md`.

## 🎨 UI Standards (Emerald Dark-Tech)
- **Colors**: Slate-900 (bg), Emerald-400/500 (accents), Red-500 (errors).
- **Font**: 'JetBrains Mono', monospace.
- **Rules**: 
  - Mobile-only (Max-width: 448px для контента).
  - Desktop: Показ заглушки "Access Denied".
  - Тип инпута для кода: `tel`.
  - Автозапоминание через `localStorage`.

## 🛠 Управление
- **PM2 Name**: `letto-fast-ui`
- **Port**: 3000
- **Domain**: `https://codecopy.ru` (via Nginx)
