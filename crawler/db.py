"""
db.py
=====
Thin database layer for the crawler.

Uses psycopg2 directly so we can call the upsert_company() Postgres function
and insert job_postings in a single transaction.

Connection is built from environment variables:
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
"""

import json
import logging
import os
import uuid
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------

def _get_dsn() -> str:
    return (
        "host={host} port={port} dbname={db} "
        "user={user} password={password} sslmode={ssl}"
    ).format(
        host=os.environ.get("POSTGRES_HOST", "db"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        db=os.environ.get("POSTGRES_DB", "berlinjob"),
        user=os.environ.get("POSTGRES_USER", "berlinjob"),
        password=os.environ.get("POSTGRES_PASSWORD", "berlinjob"),
        ssl=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )


@contextmanager
def get_connection():
    """Yield a psycopg2 connection; commit on success, rollback on error."""
    conn = psycopg2.connect(_get_dsn())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Company upsert
# ---------------------------------------------------------------------------

def upsert_company(
    conn,
    *,
    name: str,
    normalized_name: str,
    homepage_url: str,
    company_size: str | None = None,
    hq_city: str | None = None,
) -> str:
    """
    Call the upsert_company() PL/pgSQL function defined in init.sql.
    Returns the canonical company UUID as a string.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT public.upsert_company(
                %s::TEXT,
                %s::TEXT,
                %s::TEXT,
                %s::TEXT,
                %s::TEXT
            )
            """,
            (name, normalized_name, homepage_url, company_size, hq_city),
        )
        row = cur.fetchone()
        company_id = str(row[0])
        logger.debug("upsert_company -> %s (%s)", company_id, normalized_name)
        return company_id


# ---------------------------------------------------------------------------
# Job posting upsert
# ---------------------------------------------------------------------------

def insert_job_posting(
    conn,
    *,
    company_id: str,
    title: str,
    apply_url: str,
    description: str = "",
    languages: dict | None = None,
    tech_stack: list | None = None,
    remote_type: str = "Hybrid",
    is_in_berlin: bool = False,
    role_category: str | None = None,
) -> str:
    """
    Upsert a job posting row.

    ON CONFLICT (apply_url) DO UPDATE refreshes extraction data when the same
    URL is re-crawled. Requires the job_postings_apply_url_key UNIQUE constraint
    added by supabase/fix_permissions_and_dedup.sql.

    Returns the job posting UUID.
    """
    languages  = languages  or {}
    tech_stack = tech_stack or []

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.job_postings
                (company_id, title, apply_url, description,
                 languages, tech_stack, remote_type,
                 is_in_berlin, role_category)
            VALUES
                (%(company_id)s, %(title)s, %(apply_url)s, %(description)s,
                 %(languages)s::JSONB, %(tech_stack)s::JSONB, %(remote_type)s,
                 %(is_in_berlin)s, %(role_category)s)
            ON CONFLICT (apply_url) DO UPDATE SET
                title         = EXCLUDED.title,
                description   = EXCLUDED.description,
                languages     = EXCLUDED.languages,
                tech_stack    = EXCLUDED.tech_stack,
                remote_type   = EXCLUDED.remote_type,
                is_in_berlin  = EXCLUDED.is_in_berlin,
                role_category = EXCLUDED.role_category,
                scraped_at    = now(),
                updated_at    = now()
            RETURNING id
            """,
            {
                "company_id":    company_id,
                "title":         title,
                "apply_url":     apply_url,
                "description":   description,
                "languages":     json.dumps(languages),
                "tech_stack":    json.dumps(tech_stack),
                "remote_type":   remote_type,
                "is_in_berlin":  is_in_berlin,
                "role_category": role_category,
            },
        )
        row = cur.fetchone()
        # ON CONFLICT DO UPDATE always returns the row
        job_id = str(row[0]) if row else str(uuid.uuid4())
        logger.info("Upserted job posting %s: %s", job_id, title)
        return job_id


# ---------------------------------------------------------------------------
# Stale-job management
# ---------------------------------------------------------------------------

def get_stale_jobs(conn, *, days_old: int = 14, include_unknown: bool = True) -> list[dict]:
    """
    Return active job postings that are candidates for deactivation:
      - title = 'Unknown'  (crawled a dead/cookie-wall page)
      - scraped_at older than `days_old` days
    """
    conditions = []
    if include_unknown:
        conditions.append("title = 'Unknown'")
    conditions.append(f"scraped_at < NOW() - INTERVAL '{days_old} days'")
    where = " OR ".join(f"({c})" for c in conditions)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            f"""
            SELECT id, title, apply_url, scraped_at
            FROM public.job_postings
            WHERE is_active = true AND ({where})
            ORDER BY scraped_at ASC
            """
        )
        return [dict(row) for row in cur.fetchall()]


def deactivate_job(conn, job_id: str) -> None:
    """Set is_active = false for a single job posting."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE public.job_postings SET is_active = false, updated_at = now() WHERE id = %s",
            (job_id,),
        )
    logger.info("Deactivated job %s", job_id)


def bulk_deactivate_unknown(conn) -> int:
    """
    Immediately deactivate all jobs with title = 'Unknown'.
    Returns the number of rows deactivated.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.job_postings
            SET is_active = false, updated_at = now()
            WHERE is_active = true AND title = 'Unknown'
            """
        )
        count = cur.rowcount
    logger.info("Bulk-deactivated %d Unknown-title jobs", count)
    return count


# ---------------------------------------------------------------------------
# Company queries (used by the discover pipeline)
# ---------------------------------------------------------------------------

def get_active_companies(conn) -> list[dict]:
    """
    Return all active companies that have a job_board_url set.
    Used by the --discover pipeline to know which boards to crawl.
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, name, normalized_name, homepage_url,
                   job_board_url, ats_type, hq_city, company_size
            FROM public.companies
            WHERE is_active = true
              AND job_board_url IS NOT NULL
            ORDER BY name
            """
        )
        return [dict(row) for row in cur.fetchall()]


def update_last_crawled(conn, company_id: str) -> None:
    """Stamp last_crawled_at = now() after a successful board crawl."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE public.companies SET last_crawled_at = now() WHERE id = %s",
            (company_id,),
        )
    logger.debug("Stamped last_crawled_at for company %s", company_id)


def upsert_company_seed(
    conn,
    *,
    name: str,
    normalized_name: str,
    homepage_url: str,
    job_board_url: str | None = None,
    ats_type: str | None = None,
    company_size: str | None = None,
    hq_city: str | None = None,
) -> str:
    """
    Upsert a company row from the seed file.
    Also sets job_board_url and ats_type (added by add_company_fields.sql).
    Returns the company UUID.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.companies
                (name, normalized_name, homepage_url,
                 job_board_url, ats_type, company_size, hq_city)
            VALUES
                (%(name)s, %(normalized_name)s, %(homepage_url)s,
                 %(job_board_url)s, %(ats_type)s, %(company_size)s, %(hq_city)s)
            ON CONFLICT (homepage_url) DO UPDATE
                SET name             = EXCLUDED.name,
                    normalized_name  = EXCLUDED.normalized_name,
                    job_board_url    = COALESCE(EXCLUDED.job_board_url, companies.job_board_url),
                    ats_type         = COALESCE(EXCLUDED.ats_type,      companies.ats_type),
                    company_size     = COALESCE(EXCLUDED.company_size,  companies.company_size),
                    hq_city          = COALESCE(EXCLUDED.hq_city,       companies.hq_city),
                    updated_at       = now()
            RETURNING id
            """,
            {
                "name":            name,
                "normalized_name": normalized_name,
                "homepage_url":    homepage_url,
                "job_board_url":   job_board_url,
                "ats_type":        ats_type,
                "company_size":    company_size,
                "hq_city":         hq_city,
            },
        )
        row = cur.fetchone()
        company_id = str(row[0])
        logger.info("Seeded company %s (%s)", name, company_id)
        return company_id


# ---------------------------------------------------------------------------
# Convenience: full save pipeline in one call
# ---------------------------------------------------------------------------

def save_job(
    *,
    company_name: str,
    normalized_name: str,
    homepage_url: str,
    company_size: str | None = None,
    hq_city: str | None = None,
    title: str,
    apply_url: str,
    description: str = "",
    languages: dict | None = None,
    tech_stack: list | None = None,
    remote_type: str = "Hybrid",
    is_in_berlin: bool = False,
    role_category: str | None = None,
) -> dict:
    """
    Upsert company + upsert job posting in a single transaction.
    Returns {"company_id": "...", "job_id": "..."}.
    """
    with get_connection() as conn:
        company_id = upsert_company(
            conn,
            name=company_name,
            normalized_name=normalized_name,
            homepage_url=homepage_url,
            company_size=company_size,
            hq_city=hq_city,
        )
        job_id = insert_job_posting(
            conn,
            company_id=company_id,
            title=title,
            apply_url=apply_url,
            description=description,
            languages=languages,
            tech_stack=tech_stack,
            remote_type=remote_type,
            is_in_berlin=is_in_berlin,
            role_category=role_category,
        )

    return {"company_id": company_id, "job_id": job_id}
