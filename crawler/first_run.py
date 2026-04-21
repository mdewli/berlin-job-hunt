"""
first_run.py
============
First-Run Orchestrator for the Berlin Job Hub Crawler.

Reads seeds.json, auto-detects careers pages, extracts job listings,
and feeds each listing URL through the full crawl -> extract -> save pipeline.

Usage
-----
# Process first 5 companies from seeds (with DB write):
    python first_run.py --limit 5

# Dry run: detect careers pages but do NOT crawl individual jobs or touch DB:
    python first_run.py --limit 5 --dry-run

# Discover NEW companies via DuckDuckGo and add them to seeds.json:
    python first_run.py --discover

# Process a specific company by name (substring match):
    python first_run.py --company zalando

# Skip companies that already have a careers_url in seeds.json
# (useful for re-runs after manual curation):
    python first_run.py --limit 10 --skip-known
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

from discovery import (
    append_to_seeds,
    discover_berlin_companies,
    find_careers_url,
    get_job_links_from_careers_page,
    load_seeds,
)
from main import process_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("crawler.first_run")

# How many individual job postings to crawl per company
MAX_JOBS_PER_COMPANY = 10


# ---------------------------------------------------------------------------
# Core pipeline for one company
# ---------------------------------------------------------------------------

async def process_company(
    seed: dict,
    dry_run: bool = False,
) -> dict:
    """
    Full pipeline for one seed company:
        1. Resolve careers URL (use pre-filled or auto-detect)
        2. Extract individual job listing URLs from careers page
        3. For each listing: crawl -> AI extract -> save to DB

    Returns a summary dict with counts.
    """
    company_name = seed["company"]
    homepage     = seed["homepage"]
    city         = seed.get("city")
    size         = seed.get("size")

    logger.info("=" * 60)
    logger.info("Processing: %s", company_name)

    # Step 1: resolve careers URL
    careers_url = find_careers_url(
        homepage_url=homepage,
        known_careers_url=seed.get("careers_url"),
    )

    if not careers_url:
        logger.warning("No careers URL found for %s -- skipping.", company_name)
        return {"company": company_name, "careers_url": None, "jobs_found": 0, "jobs_saved": 0}

    logger.info("Careers URL: %s", careers_url)

    if dry_run:
        logger.info("[DRY RUN] Would crawl: %s", careers_url)
        return {
            "company": company_name,
            "careers_url": careers_url,
            "jobs_found": 0,
            "jobs_saved": 0,
            "dry_run": True,
        }

    # Step 2: extract job listing URLs from careers page
    job_urls = await get_job_links_from_careers_page(
        careers_url, max_jobs=MAX_JOBS_PER_COMPANY
    )

    if not job_urls:
        logger.warning("No individual job URLs found at %s", careers_url)
        return {
            "company": company_name,
            "careers_url": careers_url,
            "jobs_found": 0,
            "jobs_saved": 0,
        }

    logger.info("Found %d job listings for %s", len(job_urls), company_name)

    # Step 3: crawl + extract + save each job posting
    saved = 0
    for job_url in job_urls:
        try:
            result = await process_job(
                url=job_url,
                company_name=company_name,
                homepage=homepage,
                city=city,
                size=size,
            )
            logger.info("  Saved job: %s -> job_id=%s", job_url, result["job_id"])
            saved += 1
        except Exception as exc:
            logger.error("  Failed to process %s: %s", job_url, exc)

    return {
        "company": company_name,
        "careers_url": careers_url,
        "jobs_found": len(job_urls),
        "jobs_saved": saved,
    }


# ---------------------------------------------------------------------------
# Batch runner
# ---------------------------------------------------------------------------

async def run_first_run(
    limit: int,
    dry_run: bool,
    company_filter: str,
    skip_known: bool,
    concurrency: int = 2,
) -> None:
    """
    Load seeds, apply filters, then process companies concurrently.
    """
    seeds = load_seeds()

    # Filter by company name if requested
    if company_filter:
        seeds = [
            s for s in seeds
            if company_filter.lower() in s["company"].lower()
        ]
        if not seeds:
            logger.error("No seeds match company filter: %r", company_filter)
            sys.exit(1)

    # Skip companies that already have a resolved careers_url (re-run safety)
    if skip_known:
        seeds = [s for s in seeds if not s.get("careers_url")]
        logger.info("After --skip-known filter: %d seeds remain", len(seeds))

    seeds = seeds[:limit]
    logger.info("Running pipeline for %d companies (dry_run=%s)", len(seeds), dry_run)

    semaphore = asyncio.Semaphore(concurrency)

    async def bounded(seed: dict):
        async with semaphore:
            return await process_company(seed, dry_run=dry_run)

    results = await asyncio.gather(*(bounded(s) for s in seeds))

    # Print summary table
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total_found = 0
    total_saved = 0
    for r in results:
        if r is None:
            continue
        status = "DRY-RUN" if r.get("dry_run") else f"saved {r['jobs_saved']}/{r['jobs_found']}"
        careers = r.get("careers_url") or "NOT FOUND"
        print(f"  {r['company']:<35} {status:<15} {careers}")
        total_found += r.get("jobs_found", 0)
        total_saved += r.get("jobs_saved", 0)

    print("-" * 60)
    if not dry_run:
        print(f"Total: {total_saved} jobs saved out of {total_found} found.")
    else:
        print("Dry run complete. No data written to database.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Berlin Job Hub -- First Run Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--limit", type=int, default=5,
        help="Number of companies to process (default: 5)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Detect careers URLs only; do NOT crawl jobs or write to DB",
    )
    parser.add_argument(
        "--company",
        help="Process only companies whose name contains this string (case-insensitive)",
    )
    parser.add_argument(
        "--skip-known", action="store_true",
        help="Skip seeds that already have a careers_url filled in",
    )
    parser.add_argument(
        "--discover", action="store_true",
        help="Run DuckDuckGo discovery and append new companies to seeds.json",
    )
    parser.add_argument(
        "--concurrency", type=int, default=2,
        help="Max companies to process in parallel (default: 2)",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    if args.discover:
        logger.info("Running DuckDuckGo company discovery...")
        candidates = discover_berlin_companies(
            query="Berlin tech startup GmbH software engineer jobs",
            max_results=30,
        )
        if candidates:
            append_to_seeds(candidates)
            print(json.dumps(candidates, indent=2, ensure_ascii=False))
        else:
            logger.info("No new companies discovered.")
        return

    await run_first_run(
        limit=args.limit,
        dry_run=args.dry_run,
        company_filter=args.company or "",
        skip_known=args.skip_known,
        concurrency=args.concurrency,
    )


if __name__ == "__main__":
    asyncio.run(main())
