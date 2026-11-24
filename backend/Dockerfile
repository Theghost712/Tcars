# Build from the repository root:  docker build -f backend/Dockerfile -t tcm-backend .
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./

# Collect static files for the admin. The key here is a placeholder used only at build time.
RUN DJANGO_SECRET_KEY=build-only-placeholder python manage.py collectstatic --noinput \
 && useradd --create-home --uid 10001 app \
 && mkdir -p /app/media \
 && chown -R app:app /app/media

USER app
EXPOSE 8000

# Apply migrations on start, then serve with gunicorn.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --access-logfile -"]
