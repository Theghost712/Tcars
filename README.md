# Tanzania Car Marketplace

A web platform for buying and selling motor vehicles in Tanzania, starting with Dar es Salaam.
Buyers search and save vehicles and contact sellers; individual sellers and dealers publish listings;
administrators moderate listings, handle reports and verify sellers and dealerships.

The platform does not process payments, inspect vehicles or transfer ownership. The site says so on every page.

## What is included

| Area | Features |
|---|---|
| Accounts | Register as buyer, seller or dealer; email login with JWT (refresh rotation and logout); profile and account type; change password; password reset by email; rate limits on login, registration and reset |
| Listings | Create and edit with up to 10 photos (validated and re-encoded as JPEG); status lifecycle: pending, live, rejected, sold, expired, suspended; renew after 60 days; material edits return to review |
| Search | Keywords, make, model, region, city, price and year ranges, mileage, fuel, transmission, body type, condition, dealer; sorting; shareable URLs; similar vehicles |
| Buyers | Favourites, enquiry form, call and WhatsApp buttons, report a listing, notifications |
| Sellers and dealers | Dashboard with counts, views and enquiries; mark as sold; dealership profile; verification requests |
| Administration | Listing queue with approve, reject (with reason), suspend, restore, feature; report resolution; verification decisions; user search, role changes and suspension; moderation log; Django admin with bulk actions |
| Notifications | In-app notifications plus email for listing decisions, enquiries and verification |

Architecture: React frontend → Django REST API → PostgreSQL. Media files are stored on local disk (see limitations).

## Repository layout

```
backend/            Django project
  config/           settings, URLs, WSGI/ASGI
  apps/accounts     custom user model, auth, password reset
  apps/dealers      dealership profiles, verification requests
  apps/vehicles     listings, photos, search, favourites, enquiries, dashboard
  apps/moderation   reports, moderation log, administrator API
  apps/notifications
  apps/common       health check, phone and upload helpers, seed command
frontend/           React + TypeScript app (see frontend/README.md)
deploy/             database backup script
docker-compose.yml  full stack: PostgreSQL, Django (gunicorn), nginx-served frontend
.github/workflows/  continuous integration
```

## Run it locally

Requirements: Python 3.12+ (3.13 tested), Node 20+ (22 tested), PostgreSQL 14+.

```bash
# 1. Database
createuser -P marketplace                     # choose a password
createdb -O marketplace tanzania_car_marketplace

# 2. Backend
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                          # set DATABASE_URL to match step 1
python manage.py migrate
python manage.py seed_demo                    # demo accounts and listings (optional)
python manage.py runserver                    # http://127.0.0.1:8000

# 3. Frontend (second terminal)
cd frontend && npm install && npm run dev     # http://localhost:5173
```

Demo accounts created by `seed_demo` (password `DemoPass123!`):
`admin@demo.tzcars.test` (administrator), `seller@demo.tzcars.test`, `seller2@demo.tzcars.test`,
`dealer@demo.tzcars.test` (verified dealership), `buyer@demo.tzcars.test`.

Emails are printed to the Django console in development.

## Tests

```bash
cd backend && python manage.py test          # 80 API and model tests
cd frontend && npm test                      # unit tests
cd frontend && node e2e/smoke.mjs           # browser flow across all roles (dev servers must be running)
```

CI (`.github/workflows/ci.yml`) runs the backend checks against PostgreSQL, then type-checks, unit-tests and builds the frontend.

## Deploy with Docker

```bash
cp .env.production.example .env               # fill in every value, especially the secret key and password
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py expire_listings   # schedule this daily (see below)
```

The site is then on port 8080. Put a TLS-terminating reverse proxy (for example Caddy or a cloud load balancer)
in front of it, set `DJANGO_SECURE_SSL_REDIRECT=true` and `DJANGO_HSTS_SECONDS` when HTTPS is in place,
and point `FRONTEND_URL` at the public address so email links work.

Operational tasks:

- **Expire listings daily.** Run `python manage.py expire_listings` from cron or your scheduler, for example
  `docker compose exec -T backend python manage.py expire_listings` at 03:00.
- **Backups.** `DATABASE_URL=... deploy/backup-db.sh` writes compressed dumps and keeps 14 days. Add it to cron
  (see the script header). Also back up the `media` volume, which holds vehicle photos.
- **Monitoring.** `GET /api/health/` returns `200` when the database is reachable and `503` otherwise.
  Point an uptime monitor at it. Check `docker compose logs backend` for application errors.
- **Restore.** `gunzip -c tcm-<stamp>.sql.gz | psql "$DATABASE_URL"` into an empty database.

## Security notes

- Passwords are hashed by Django (PBKDF2) and checked against the built-in validators.
- Login, registration, password reset and enquiries are rate limited.
- Photos are checked for size and real image content, limited in pixel count, and re-encoded, which strips metadata.
- Role checks happen on the server for every write. Users cannot grant themselves the administrator role.
- Suspended accounts cannot sign in. Suspended listings cannot be edited by their sellers.
- Password reset responses never reveal whether an email is registered.
- Production settings enable secure cookies, HSTS and content-type protection when `DJANGO_DEBUG` is off.

## Known limitations

- **Photo storage is local disk.** Fine for one server; move `MEDIA_ROOT` to object storage before scaling out.
- **Access tokens are kept in browser local storage.** This is common for single-page apps. Serve the site over HTTPS
  and keep the strict Content Security Policy in mind before adding third-party scripts.
- **Email is not configured by default.** Development prints it to the console; set the `EMAIL_*` variables for production.
- **No payments, inspections or ownership transfer**, by design (see the project scope).
- **Real-time messaging** is not included; enquiries are stored and emailed.
- The Docker images were built with the same Dockerfile steps tested locally (collectstatic, migrations, gunicorn),
  but the image build itself could not be completed in the development sandbox, which hit a registry rate limit.
