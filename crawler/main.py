"""
main.py
=======
BerlinJobHunt Crawler -- Main Orchestrator

Modes
-----
Single URL (ad-hoc / debugging):
    python main.py --url "https://jobs.example.com/backend-engineer"
                   --company "Example GmbH"
                   --homepage "https://example.com"
                   [--city Berlin] [--size Startup] [--dry-run]

Batch mode:
    python main.py --batch targets.jsonl

Seed the companies table:
    python main.py --seed companies_seed.jsonl

Automated discovery (crawl every active company's job board):
    python main.py --discover
    python main.py --discover --company-limit 5

Auto-discover new companies from aggregator sites:
    python main.py --discover-companies [--limit 200]

Pull jobs from Arbeitnow:
    python main.py --fetch-aggregators [--pages 10]

Check and deactivate stale / 404 jobs:
    python main.py --check-stale [--days-old 14]
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

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
from aggregators.arbeitnow import fetch_arbeitnow_jobs
from utils.ai_extractor import extract_job_data
from utils.fetch import fetch_markdown
from utils.normalization import normalize_company, normalize_name, clean_url

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
    Returns {"company_id": "...", "job_id": "..."} or None if skipped.
    """
    markdown = await fetch_markdown(url, wait_seconds=wait_seconds)

    logger.info("Extracting structured data with DeepSeek...")
    extracted = extract_job_data(markdown)
    logger.info(
        "Extracted: title=%r  location=%r  berlin=%s  remote=%s",
        extracted["title"],
        extracted.get("location_raw", "?"),
        extracted["is_berlin_compatible"],
        extracted["remote_type"],
    )

    # ── Gate 1: Dead-link / cookie-wall guard ────────────────────────────────
    if extracted["title"] == "Unknown":
        logger.warning(
            "Skipping %s — title is Unknown (dead link / cookie wall). "
            "Markdown was %d chars.", url, len(markdown),
        )
        return None

    # ── Gate 2: Location quality gate ────────────────────────────────────────
    # Only save jobs that a person living in Berlin can actually do.
    # This catches things like HelloFresh Canada roles where the company
    # mentions "Berlin HQ" in its description but the job is in Toronto.
    if not extracted["is_berlin_compatible"]:
        logger.info(
            "Skipping %s — not Berlin-compatible "
            "(location_raw=%r, remote_type=%s).",
            url,
            extracted.get("location_raw", ""),
            extracted["remote_type"],
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
    with get_connection() as conn:
        companies = get_active_companies(conn)

    if not companies:
        logger.warning("No active companies with job_board_url found. Run --seed first.")
        return

    if company_limit:
        companies = companies[:company_limit]

    logger.info("Discovering jobs across %d companies...", len(companies))
    total_saved = 0
    total_found = 0

    for company in companies:
        logger.info("--- %s ---", company["name"])
        try:
            job_entries = await discover_jobs(company)
        except Exception as exc:
            logger.error("Discovery failed for %s: %s", company["name"], exc)
            continue

        total_found += len(job_entries)
        logger.info("Found %d job links for %s", len(job_entries), company["name"])

        if not job_entries:
            continue

        semaphore = asyncio.Semaphore(5)

        async def process_entry(entry: dict):
            async with semaphore:
                try:
                    return await process_job(
                        url=entry["url"],
                        company_name=entry["company_name"],
                        homepage=entry["homepage_url"],
                        city=entry.get("hq_city"),
                        size=entry.get("company_size"),
                        wait_seconds=3.0,
                    )
                except Exception as exc:
                    logger.error("Pipeline failed for %s: %s", entry.get("url"), exc)
                    return None

        results = await asyncio.gather(*(process_entry(e) for e in job_entries))
        saved    = [r for r in results if r]
        total_saved += len(saved)
        logger.info(
            "Saved %d/%d postings for %s",
            len(saved), len(job_entries), company["name"],
        )

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
    import aiohttp

    with get_connection() as conn:
        removed = bulk_deactivate_unknown(conn)
    logger.info("Phase 1: deactivated %d Unknown-title jobs.", removed)

    with get_connection() as conn:
        stale = get_stale_jobs(conn, days_old=days_old, include_unknown=False)

    if not stale:
        logger.info("Phase 2: no jobs older than %d days.", days_old)
        return

    logger.info("Phase 2: checking %d old job URLs for liveness...", len(stale))
    semaphore  = asyncio.Semaphore(10)
    deactivated = 0

    async def check_one(job: dict) -> bool:
        async with semaphore:
            url = job["apply_url"]
            try:
                timeout = aiohttp.ClientTimeout(total=12)
                headers = {"User-Agent": "Mozilla/5.0 (compatible; BerlinJobHunt/1.0)"}
                async with aiohttp.ClientSession(headers=headers) as session:
                    async with session.head(url, allow_redirects=True, timeout=timeout) as resp:
                        if resp.status == 404:
                            logger.info("Dead (404): %s", url)
                            with get_connection() as conn:
                                deactivate_job(conn, str(job["id"]))
                            return True
                        return False
            except Exception:
                return False

    results     = await asyncio.gather(*(check_one(j) for j in stale))
    deactivated = sum(1 for r in results if r)
    logger.info("Stale check done: %d/%d deactivated.", deactivated, len(stale))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="BerlinJobHunt Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--url",                 help="Single job posting URL to crawl")
    mode.add_argument("--batch",               help="Path to .jsonl batch file")
    mode.add_argument("--seed",                help="Path to companies_seed.jsonl")
    mode.add_argument("--discover",            action="store_true")
    mode.add_argument("--check-stale",         action="store_true")
    mode.add_argument("--discover-companies",  action="store_true")
    mode.add_argument("--fetch-aggregators",   action="store_true")

    parser.add_argument("--company",       help="Company display name (--url mode)")
    parser.add_argument("--homepage",      help="Company homepage URL (--url mode)")
    parser.add_argument("--city",          help="HQ city, e.g. Berlin")
    parser.add_argument("--size",          choices=["Micro", "Startup", "Mid-size", "Enterprise"])
    parser.add_argument("--wait",          type=float, default=3.0)
    parser.add_argument("--company-limit", type=int,   default=None)
    parser.add_argument("--limit",         type=int,   default=None)
    parser.add_argument("--pages",         type=int,   default=20)
    parser.add_argument("--days-old",      type=int,   default=14)
    parser.add_argument("--dry-run",       action="store_true")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    if args.seed:
        await run_seed(args.seed)
        return

    if args.fetch_aggregators:
        count = await fetch_arbeitnow_jobs(max_pages=args.pages)
        print(f"Aggregator fetch complete: {count} jobs saved.")
        return

    if args.discover_companies:
        count = await discover_companies(limit=args.limit)
        print(f"Company discovery complete: {count} companies upserted.")
        return

    if args.check_stale:
        await run_check_stale(days_old=args.days_old)
        return

    if args.discover:
        await run_discover(company_limit=args.company_limit)
        return

    if args.batch:
        await run_batch(args.batch)
        return

    # Single URL mode
    if not args.company or not args.homepage:
        print("ERROR: --company and --homepage are required with --url.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        markdown  = await fetch_markdown(args.url, wait_seconds=args.wait)
        extracted = extract_job_data(markdown)
        normed    = normalize_company(args.company, args.homepage)
        print("\n" + "=" * 60)
        print("MARKDOWN PREVIEW (first 1500 chars):")
        print("=" * 60)
        print(markdown[:1500] if markdown else "(empty)")
        print("=" * 60 + "\n")
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
