"""
main.py
=======
Berlin Job Hub Crawler -- Main Orchestrator

Modes
-----
Single URL (ad-hoc / debugging):
    python main.py --url "https://jobs.example.com/backend-engineer"
                   --company "Example GmbH"
                   --homepage "https://example.com"
                   [--city Berlin] [--size Startup] [--dry-run]

Batch mode (list of JSON lines in a file):
    python main.py --batch targets.jsonl

Seed the companies table from a JSONL file:
    python main.py --seed companies_seed.jsonl

Automated discovery (crawl every active company's job board):
    python main.py --discover
    python main.py --discover --company-limit 5   # process only first N companies

Auto-discover new companies from aggregator sites:
    python main.py --discover-companies
    python main.py --discover-companies --limit 200

Environment variables required:
    DEEPSEEK_API_KEY
    POSTGRES_HOST / POSTGRES_PORT / POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD

Pipeline (--discover)
---------------------
1. Load all active companies with a job_board_url from the DB.
2. For each company, crawl the board page and extract job links (discover.py).
3. For each discovered job URL, run the full single-URL pipeline:
      fetch_markdown -> extract_job_data -> normalize_company -> save_job
4. Stamp last_crawled_at on the company.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Local imports
sys.path.insert(0, str(Path(__file__).parent))
from db import (
    get_active_companies,
    get_stale_jobs,
    deactivate_job,
    bulk_deactivate_unknown,
    save_job,
    update_last_crawled,
    upsert_company_seed,
    get_connection,
)
from discover import discover_jobs
from company_discovery import discover_companies
from utils.ai_extractor import extract_job_data
from utils.fetch import fetch_markdown
from utils.normalization import normalize_company, normalize_name, clean_url

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("crawler.main")


# ---------------------------------------------------------------------------
# Single-posting pipeline
# ---------------------------------------------------------------------------

async def process_job(
    *,
    url: str,
    company_name: str,
    homepage: str,
    city: str | None = None,
    size: str | None = None,
    wait_seconds: float = 3.0,
) -> dict:
    """
    Full pipeline for a single job posting URL.
    Returns {"company_id": "...", "job_id": "..."}.
    """
    markdown = await fetch_markdown(url, wait_seconds=wait_seconds)

    logger.info("Extracting structured data with DeepSeek...")
    extracted = extract_job_data(markdown)
    logger.info(
        "Extracted: title=%r  category=%r  berlin=%s  remote=%s",
        extracted["title"],
        extracted["role_category"],
        extracted["is_berlin_compatible"],
        extracted["remote_type"],
    )
    logger.debug("tech_stack: %s", extracted["tech_stack"])
    logger.debug("languages:  %s", extracted["languages"])

    # ── Dead-link guard ───────────────────────────────────────────────────────
    # If DeepSeek couldn't extract a title the page was almost certainly a
    # cookie wall, "job not found" redirect, or empty SPA shell.
    # Don't pollute the DB with useless rows.
    if extracted["title"] == "Unknown":
        logger.warning(
            "Skipping %s — title is Unknown (dead link / cookie wall / empty page). "
            "Markdown was %d chars.",
            url, len(markdown),
        )
        return None
    # ─────────────────────────────────────────────────────────────────────────

    normed = normalize_company(company_name, homepage)

    logger.info("Saving to database...")
    result = save_job(
        company_name=company_name,
        normalized_name=normed["normalized_name"],
        homepage_url=normed["homepage_url"],
        company_size=size,
        hq_city=city,
        title=extracted["title"],
        apply_url=url,
        description="",
        languages=extracted["languages"],
        tech_stack=extracted["tech_stack"],
        remote_type=extracted["remote_type"],
        is_in_berlin=extracted["is_berlin_compatible"],
        role_category=extracted["role_category"],
    )

    logger.info("Saved  company_id=%s  job_id=%s", result["company_id"], result["job_id"])
    return result


# ---------------------------------------------------------------------------
# Batch mode
# ---------------------------------------------------------------------------

async def run_batch(jsonl_path: str) -> None:
    path = Path(jsonl_path)
    if not path.exists():
        raise FileNotFoundError(f"Batch file not found: {jsonl_path}")

    targets = []
    with path.open() as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                targets.append(json.loads(line))
            except json.JSONDecodeError as exc:
                logger.warning("Line %d: invalid JSON, skipping (%s)", lineno, exc)

    logger.info("Batch: %d targets loaded from %s", len(targets), jsonl_path)
    semaphore = asyncio.Semaphore(3)

    async def bounded(target: dict):
        async with semaphore:
            try:
                return await process_job(
                    url=target["url"],
                    company_name=target["company"],
                    homepage=target["homepage"],
                    city=target.get("city"),
                    size=target.get("size"),
                )
            except Exception as exc:
                logger.error("Failed %s: %s", target.get("url"), exc)
                return None

    results = await asyncio.gather(*(bounded(t) for t in targets))
    saved   = [r for r in results if r]
    logger.info("Batch complete: %d/%d saved successfully.", len(saved), len(targets))


# ---------------------------------------------------------------------------
# Seed mode
# ---------------------------------------------------------------------------

async def run_seed(jsonl_path: str) -> None:
    """
    Load companies from a JSONL seed file and upsert them into the DB.

    Each line: {"name": "...", "homepage": "...", "job_board_url": "...",
                "ats_type": "...", "city": "...", "size": "..."}
    """
    path = Path(jsonl_path)
    if not path.exists():
        raise FileNotFoundError(f"Seed file not found: {jsonl_path}")

    companies = []
    with path.open() as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                companies.append(json.loads(line))
            except json.JSONDecodeError as exc:
                logger.warning("Seed line %d: invalid JSON, skipping (%s)", lineno, exc)

    logger.info("Seeding %d companies from %s", len(companies), jsonl_path)

    with get_connection() as conn:
        for c in companies:
            try:
                upsert_company_seed(
                    conn,
                    name=c["name"],
                    normalized_name=normalize_name(c["name"]),
                    homepage_url=clean_url(c["homepage"]),
                    job_board_url=c.get("job_board_url"),
                    ats_type=c.get("ats_type"),
                    company_size=c.get("size"),
                    hq_city=c.get("city"),
                )
            except Exception as exc:
                logger.error("Failed to seed %r: %s", c.get("name"), exc)

    logger.info("Seed complete.")


# ---------------------------------------------------------------------------
# Discover mode
# ---------------------------------------------------------------------------

async def run_discover(company_limit: int | None = None) -> None:
    """
    1. Load active companies with job_board_url from the DB.
    2. For each, discover individual job posting URLs.
    3. Run the full pipeline on each discovered posting.
    4. Stamp last_crawled_at.
    """
    with get_connection() as conn:
        companies = get_active_companies(conn)

    if not companies:
        logger.warning("No active companies with job_board_url found. Run --seed first.")
        return

    if company_limit:
        companies = companies[:company_limit]

    logger.info("Discovering jobs across %d companies...", len(companies))

    # Process one company at a time to avoid hammering multiple sites
    total_saved = 0
    total_found = 0

    for company in companies:
        logger.info("--- %s ---", company["name"])

        # Step 1: Discover job URLs on the board page
        try:
            job_entries = await discover_jobs(company)
        except Exception as exc:
            logger.error("Discovery failed for %s: %s", company["name"], exc)
            continue

        total_found += len(job_entries)
        logger.info("Found %d job links for %s", len(job_entries), company["name"])

        if not job_entries:
            continue

        # Step 2: Full pipeline for each posting (max 5 concurrent per company)
        semaphore = asyncio.Semaphore(5)

        async def process_entry(entry: dict):
            async with semaphore:
                try:
                    result = await process_job(
                        url=entry["url"],
                        company_name=entry["company_name"],
                        homepage=entry["homepage_url"],
                        city=entry.get("hq_city"),
                        size=entry.get("company_size"),
                        wait_seconds=3.0,
                    )
                    return result
                except Exception as exc:
                    logger.error("Pipeline failed for %s: %s", entry.get("url"), exc)
                    return None

        results = await asyncio.gather(*(process_entry(e) for e in job_entries))
        saved = [r for r in results if r]
        total_saved += len(saved)
        logger.info("Saved %d/%d postings for %s", len(saved), len(job_entries), company["name"])

        # Stamp crawl timestamp
        if company.get("id"):
            with get_connection() as conn:
                update_last_crawled(conn, str(company["id"]))

    logger.info(
        "Discovery complete: %d postings found, %d saved.",
        total_found, total_saved,
    )


# ---------------------------------------------------------------------------
# Stale-job checker
# ---------------------------------------------------------------------------

async def run_check_stale(days_old: int = 14) -> None:
    """
    1. Immediately deactivate all jobs with title = 'Unknown'.
    2. For jobs older than `days_old` days, fire a cheap HEAD request.
       If the server returns 404 → deactivate.
    """
    import aiohttp

    # Phase 1: bulk-remove Unknown-title junk
    with get_connection() as conn:
        removed = bulk_deactivate_unknown(conn)
    logger.info("Phase 1: deactivated %d Unknown-title jobs.", removed)

    # Phase 2: HTTP liveness check on old postings
    with get_connection() as conn:
        stale = get_stale_jobs(conn, days_old=days_old, include_unknown=False)

    if not stale:
        logger.info("Phase 2: no jobs older than %d days — nothing to check.", days_old)
        return

    logger.info("Phase 2: checking %d old job URLs for liveness...", len(stale))

    semaphore = asyncio.Semaphore(10)
    deactivated = 0

    async def check_one(job: dict) -> bool:
        """Return True if the URL is dead (404) and was deactivated."""
        async with semaphore:
            url = job["apply_url"]
            try:
                timeout = aiohttp.ClientTimeout(total=12)
                headers = {"User-Agent": "Mozilla/5.0 (compatible; BerlinJobHub/1.0)"}
                async with aiohttp.ClientSession(headers=headers) as session:
                    async with session.head(url, allow_redirects=True, timeout=timeout) as resp:
                        if resp.status == 404:
                            logger.info("Dead (404): %s — deactivating.", url)
                            with get_connection() as conn:
                                deactivate_job(conn, str(job["id"]))
                            return True
                        logger.debug("Alive (%d): %s", resp.status, url)
                        return False
            except asyncio.TimeoutError:
                logger.debug("Timeout (assumed alive): %s", url)
                return False
            except Exception as exc:
                logger.debug("Error checking %s: %s (assumed alive)", url, exc)
                return False

    results = await asyncio.gather(*(check_one(j) for j in stale))
    deactivated = sum(1 for r in results if r)
    logger.info(
        "Stale check complete: %d/%d jobs deactivated.",
        deactivated, len(stale),
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Berlin Job Hub Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--url",          help="Single job posting URL to crawl")
    mode.add_argument("--batch",        help="Path to .jsonl file with batch targets")
    mode.add_argument("--seed",         help="Path to companies_seed.jsonl to load into DB")
    mode.add_argument("--discover",     action="store_true",
                      help="Crawl all active companies job boards and save postings")
    mode.add_argument("--check-stale",  action="store_true",
                      help="Deactivate Unknown-title jobs and 404 old postings")
    mode.add_argument("--discover-companies", action="store_true",
                      help="Auto-discover companies from aggregator sites and seed the DB")

    parser.add_argument("--company",       help="Company display name (required with --url)")
    parser.add_argument("--homepage",      help="Company homepage URL (required with --url)")
    parser.add_argument("--city",          help="HQ city, e.g. Berlin")
    parser.add_argument("--size",          choices=["Micro", "Startup", "Mid-size", "Enterprise"])
    parser.add_argument("--wait",          type=float, default=3.0,
                        help="Seconds to wait for JS rendering (default: 3.0)")
    parser.add_argument("--company-limit", type=int, default=None,
                        help="Max number of companies to process in --discover mode")
    parser.add_argument("--limit",          type=int, default=None,
                        help="Max companies to upsert in --discover-companies mode")
    parser.add_argument("--days-old",      type=int, default=14,
                        help="Jobs older than N days are checked for staleness (default: 14)")
    parser.add_argument("--dry-run",       action="store_true",
                        help="Crawl and extract but do NOT write to the database")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    # --- Seed mode ---
    if args.seed:
        await run_seed(args.seed)
        return

    # --- Discover-companies mode ---
    if args.discover_companies:
        count = await discover_companies(limit=args.limit)
        print(f"Company discovery complete: {count} companies upserted.")
        return

    # --- Stale check mode ---
    if args.check_stale:
        await run_check_stale(days_old=args.days_old)
        return

    # --- Discover mode ---
    if args.discover:
        await run_discover(company_limit=args.company_limit)
        return

    # --- Batch mode ---
    if args.batch:
        if args.dry_run:
            logger.warning("--dry-run is not supported in batch mode; ignored.")
        await run_batch(args.batch)
        return

    # --- Single URL mode ---
    if not args.company or not args.homepage:
        print("ERROR: --company and --homepage are required when using --url.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        markdown = await fetch_markdown(args.url, wait_seconds=args.wait)

        print("\n" + "=" * 60)
        print("RAW MARKDOWN PREVIEW (first 1500 chars):")
        print("=" * 60)
        print(markdown[:1500] if markdown else "(empty — Crawl4AI returned nothing)")
        print("=" * 60 + "\n")

        extracted = extract_job_data(markdown)
        normed    = normalize_company(args.company, args.homepage)
        print(json.dumps({**extracted, **normed}, indent=2))
        return

    result = await process_job(
        url=args.url,
        company_name=args.company,
        homepage=args.homepage,
        city=args.city,
        size=args.size,
        wait_seconds=args.wait,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
