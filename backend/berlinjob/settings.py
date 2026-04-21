"""
Django settings for Berlin Job Hub.
Reads all secrets from environment variables (see .env.example).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.getenv("DJANGO_DEBUG", "False") == "True"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost 127.0.0.1").split()

# ── Installed apps ────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.postgres",   # SearchVectorField, SearchQuery, SearchRank
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local
    "jobs",
]

# ── Middleware ─────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",   # must be first
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ── URLs / WSGI ───────────────────────────────────────────────────────────────
ROOT_URLCONF = "berlinjob.urls"
WSGI_APPLICATION = "berlinjob.wsgi.application"

# ── Database ──────────────────────────────────────────────────────────────────
# Direct Postgres connection: the postgres superuser bypasses RLS automatically.
# When POSTGRES_POOLER=transaction (Supabase PgBouncer port 6543) we must
# disable server-side cursors because PgBouncer transaction mode does not
# support them.
_pooler_mode = os.getenv("POSTGRES_POOLER", "").lower()

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "berlinjob"),
        "USER": os.getenv("POSTGRES_USER", "berlinjob"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "berlinjob"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "OPTIONS": {"options": "-c search_path=public"},
        # Keep connections alive for 60s (ignored in transaction pooler mode)
        "CONN_MAX_AGE": 0 if _pooler_mode == "transaction" else 60,
        # Required for Supabase PgBouncer transaction mode
        "DISABLE_SERVER_SIDE_CURSORS": _pooler_mode == "transaction",
    }
}

# ── DRF ───────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_AUTHENTICATION_CLASSES": [],   # JWT verified manually via Supabase
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173 http://localhost:3000",
).split()

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# JWT Secret: used to verify tokens sent by logged-in users.
# Dashboard -> Settings -> API -> JWT Settings -> JWT Secret
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Berlin"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
