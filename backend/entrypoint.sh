#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting gunicorn..."
exec gunicorn berlinjob.wsgi:application --bind 0.0.0.0:8000 --workers 2
