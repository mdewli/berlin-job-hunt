"""
preflight.py
============
Run this before starting the stack for the first time.
It checks .env completeness, Supabase reachability, and the DB connection.

Usage (from the berlinjobhunt/ root):
    python tools/preflight.py
"""

import importlib
import os
import sys
from pathlib import Path

# Load .env from project root
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    print("WARN: python-dotenv not installed; reading os.environ only.")

PASS = "[ OK  ]"
FAIL = "[FAIL ]"
WARN = "[ WARN]"

results = []

def check(label, ok, detail=""):
    tag = PASS if ok else FAIL
    line = f"  {tag}  {label}"
    if detail:
        line += f"\n          {detail}"
    results.append((ok, line))
    print(line)


# ── 1. Required env vars ──────────────────────────────────────────────────────
print("\nEnvironment variables")
print("-" * 50)
required = {
    "DJANGO_SECRET_KEY":    "Django secret (auto-generated)",
    "POSTGRES_HOST":        "Supabase DB host",
    "POSTGRES_DB":          "Supabase DB name (usually 'postgres')",
    "POSTGRES_USER":        "DB user (postgres or berlinjob_app)",
    "POSTGRES_PASSWORD":    "DB password",
    "SUPABASE_URL":         "Supabase project URL",
    "SUPABASE_ANON_KEY":    "Supabase anon key",
    "SUPABASE_JWT_SECRET":  "JWT secret for verifying user tokens",
    "DEEPSEEK_API_KEY":     "DeepSeek API key for job extraction",
    "VITE_SUPABASE_URL":    "Supabase URL for React frontend",
    "VITE_SUPABASE_ANON_KEY": "Anon key for React frontend",
}
for key, desc in required.items():
    val = os.getenv(key, "")
    ok = bool(val) and "change-me" not in val and "your-" not in val
    check(f"{key} ({desc})", ok, "" if ok else "Set this in .env")

# ── 2. Python packages ────────────────────────────────────────────────────────
print("\nPython packages")
print("-" * 50)
packages = {
    "django":       "pip install django",
    "rest_framework": "pip install djangorestframework",
    "psycopg2":     "pip install psycopg2-binary",
    "jwt":          "pip install PyJWT",
    "dotenv":       "pip install python-dotenv",
}
for pkg, hint in packages.items():
    try:
        importlib.import_module(pkg)
        check(pkg, True)
    except ImportError:
        check(pkg, False, f"Missing: {hint}")

# Crawler packages (optional for backend-only check)
print()
crawler_pkgs = {"crawl4ai": "pip install crawl4ai", "openai": "pip install openai"}
for pkg, hint in crawler_pkgs.items():
    try:
        importlib.import_module(pkg)
        check(f"{pkg} (crawler)", True)
    except ImportError:
        check(f"{pkg} (crawler)", False, f"Install before running crawler: {hint}")

# ── 3. Supabase HTTP reachability ─────────────────────────────────────────────
print("\nNetwork")
print("-" * 50)
supabase_url = os.getenv("SUPABASE_URL", "")
if supabase_url:
    try:
        import urllib.request
        req = urllib.request.Request(supabase_url + "/rest/v1/", method="HEAD")
        req.add_header("apikey", os.getenv("SUPABASE_ANON_KEY", ""))
        with urllib.request.urlopen(req, timeout=6) as resp:
            check("Supabase REST API reachable", resp.status < 500,
                  f"HTTP {resp.status}")
    except Exception as exc:
        check("Supabase REST API reachable", False, str(exc))
else:
    check("Supabase REST API reachable", False, "SUPABASE_URL not set")

# ── 4. Postgres connection ────────────────────────────────────────────────────
print("\nDatabase")
print("-" * 50)
try:
    import psycopg2
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        connect_timeout=8,
        sslmode="require",
    )
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM public.companies;")
    company_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM public.job_postings;")
    job_count = cur.fetchone()[0]
    conn.close()
    check("Postgres connection", True,
          f"companies={company_count}  job_postings={job_count}")
except ImportError:
    check("Postgres connection", False, "psycopg2 not installed")
except Exception as exc:
    check("Postgres connection", False, str(exc))

# ── 5. Tables exist check ─────────────────────────────────────────────────────
try:
    import psycopg2
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        connect_timeout=8,
        sslmode="require",
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('companies','job_postings','saved_jobs')
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    conn.close()
    missing = {'companies','job_postings','saved_jobs'} - set(tables)
    if missing:
        check("Supabase tables", False,
              f"Missing: {missing}. Run supabase/init.sql in the Supabase SQL editor.")
    else:
        check("Supabase tables (companies, job_postings, saved_jobs)", True)
except Exception:
    pass  # already reported connection failure above

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 50)
failures = [r for ok, r in results if not ok]
if not failures:
    print("All checks passed. Ready to run.")
else:
    print(f"{len(failures)} check(s) failed. Fix the items above, then re-run.")
print()
