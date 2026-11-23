# Tanzania Car Marketplace

A web platform for buying and selling motor vehicles in Tanzania, starting with Dar es Salaam.

This repository currently contains **Phase 1: Project Foundation** from the project specification:

- Django 5.2 + Django REST Framework backend, configured for PostgreSQL, Simple JWT, CORS and production security settings.
- React 19 + TypeScript + Vite + Tailwind CSS frontend, with React Router and an Axios API client.
- A working connection between the two: the frontend home page reads `GET /api/health/`.

Later phases (accounts, listings, search, dashboards, administration) are not implemented yet.

## Layout

```
backend/    Django project (config/ settings, apps/common health check)
frontend/   React + TypeScript app (src/api, src/components, src/pages)
```

## Local development

Prerequisites: Python 3.12+, Node 20+, PostgreSQL 14+.

1. Create the database:

   ```bash
   createuser -P marketplace        # choose a password
   createdb -O marketplace tanzania_car_marketplace
   ```

2. Backend:

   ```bash
   cd backend
   python3 -m venv .venv && . .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env             # then set DATABASE_URL and DJANGO_SECRET_KEY
   python manage.py migrate
   python manage.py runserver        # http://127.0.0.1:8000
   ```

3. Frontend (new terminal):

   ```bash
   cd frontend
   npm install
   npm run dev                       # http://localhost:5173, proxies /api to :8000
   ```

4. Tests:

   ```bash
   cd backend && python manage.py test
   cd frontend && npm run build
   ```

## Configuration

Backend settings are read from environment variables (see `backend/.env.example`).
`DJANGO_SECRET_KEY` is required unless `DJANGO_DEBUG=true`. Never commit `.env`.

## Health check

`GET /api/health/` returns `200 {"status": "ok", "database": "ok"}` when the database is reachable,
and `503` with `"status": "degraded"` otherwise. It requires no authentication, so monitoring tools can call it.
