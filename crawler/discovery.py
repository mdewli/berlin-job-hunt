"""
discovery.py
============
Three-layer discovery engine for the Berlin Job Hub crawler.

Layer 1 - Seed loading     : Read curated targets from seeds.json.
Layer 2 - Careers detection: Visit a company homepage and find the careers URL.
Layer 3 - Job enumeration  : Crawl a careers page and extract individual job URLs.
Layer 4 - New company hunt : Search DuckDuckGo for undiscovered Berlin tech companies.

All network calls are synchronous (requests) except where Crawl4AI is needed
for JavaScript-heavy pages (get_job_links_from_careers_page).
"""

import json
import logging
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SEEDS_PATH = Path(__file__).parent / "seeds.json"

REQUEST_TIMEOUT = 10  # seconds
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; BerlinJobHuntBot/1.0; "
        "+https://berlinjobhunt.dev)"
    )
}

# Keywords for careers-page detection, ordered by decreasing specificity.
# Each entry: (keyword_in_href_or_text, score)
CAREERS_KEYWORDS: list[tuple[str, int]] = [
    ("karriere",          100),
    ("careers",           100),
    ("stellenangebote",    90),
    ("jobs",               80),
    ("work-with-us",       75),
    ("join-us",            75),
    ("join-our-team",      70),
    ("open-positions",     70),
    ("open-roles",         70),
    ("we-are-hiring",      65),
    ("hiring",             60),
    ("team",               20),  # low: too generic on its own
]

# Known Applicant Tracking System (ATS) domains.
# A link to one of these is almost certainly a careers page.
ATS_DOMAINS = {
    "greenhouse.io",
    "lever.co",
    "jobs.lever.co",
    "workday.com",
    "myworkdayjobs.com",
    "smartrecruiters.com",
    "taleo.net",
    "icims.com",
    "bamboohr.com",
    "recruitee.com",
    "personio.de",
    "join.com",
    "stepstone.de",
}

# URL patterns that indicate an *individual* job posting (not a listing page).
# Used to filter careers-page links down to actual job ads.
JOB_POSTING_PATTERNS = re.compile(
    r"/jobs?/"
    r"|/positions?/"
    r"|/openings?/"
    r"|/roles?/"
    r"|/apply/"
    r"|/careers?/[^/]+$"        # e.g. /careers/backend-engineer-berlin
    r"|/stellenangebote/[^/]+$",
    re.IGNORECASE,
)

# Domains we recognise as hosting individual job ads (ATS job pages)
ATS_JOB_DOMAINS = re.compile(
    r"greenhouse\.io/[^/]+/jobs/"
    r"|lever\.co/[^/]+/[0-9a-f\-]{30,}"
    r"|jobs\.lever\.co/.+",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Layer 1: Seed loading
# ---------------------------------------------------------------------------

def load_seeds(path: Path = SEEDS_PATH) -> list[dict]:
    """
    Load and return the list of seed company dicts from seeds.json.

    Each dict has at minimum: company, homepage, city, size.
    careers_url is optional (may be null/None).
    """
    with open(path, encoding="utf-8") as f:
        seeds = json.load(f)
    logger.info("Loaded %d seeds from %s", len(seeds), path)
    return seeds


# ---------------------------------------------------------------------------
# Layer 2: Careers URL detection
# ---------------------------------------------------------------------------

def _score_link(href: str, text: str) -> int:
    """
    Return a relevance score for a candidate careers link.
    Higher = more likely to be the careers page.
    """
    score = 0
    combined = (href + " " + text).lower()

    # ATS domain match is a very strong signal
    parsed = urlparse(href)
    if any(ats in parsed.netloc for ats in ATS_DOMAINS):
        score += 200

    for keyword, weight in CAREERS_KEYWORDS:
        if keyword in combined:
            score += weight

    return score


def find_careers_url(
    homepage_url: str,
    known_careers_url: Optional[str] = None,
    timeout: int = REQUEST_TIMEOUT,
) -> Optional[str]:
    """
    Detect a company's careers page URL.

    Priority:
      1. If `known_careers_url` is provided (from seeds.json), return it directly.
      2. Fetch the homepage and score all <a> tags for careers relevance.
      3. Return the highest-scoring link, or None if nothing plausible is found.

    Parameters
    ----------
    homepage_url       : Company homepage (e.g. https://zalando.de)
    known_careers_url  : Pre-filled value from seeds.json (can be None)
    timeout            : HTTP request timeout in seconds

    Returns
    -------
    Canonical careers URL string, or None.
    """
    if known_careers_url:
        logger.debug("Using pre-filled careers URL: %s", known_careers_url)
        return known_careers_url

    logger.info("Auto-detecting careers URL for: %s", homepage_url)

    try:
        resp = requests.get(
            homepage_url,
            headers=REQUEST_HEADERS,
            timeout=timeout,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Could not fetch homepage %s: %s", homepage_url, exc)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    base = "{scheme}://{netloc}".format(
        scheme=urlparse(resp.url).scheme,
        netloc=urlparse(resp.url).netloc,
    )

    best_score = 0
    best_url: Optional[str] = None

    for tag in soup.find_all("a", href=True):
        href = tag["href"].strip()
        text = tag.get_text(strip=True)

        if not href or href.startswith("#") or href.startswith("mailto:"):
            continue

        absolute = urljoin(base, href)
        score = _score_link(absolute, text)

        if score > best_score:
            best_score = score
            best_url = absolute

    if best_url and best_score >= 60:
        logger.info("Found careers URL (score=%d): %s", best_score, best_url)
        return best_url

    logger.warning(
        "No careers URL found for %s (best score=%d)", homepage_url, best_score
    )
    return None


# ---------------------------------------------------------------------------
# Layer 3: Job listing extraction from a careers page
# ---------------------------------------------------------------------------

async def get_job_links_from_careers_page(
    careers_url: str,
    max_jobs: int = 30,
) -> list[str]:
    """
    Crawl a careers page (JavaScript-rendered via Crawl4AI) and return a list
    of individual job posting URLs found on it.

    Uses two heuristics:
      a) URL-pattern matching (JOB_POSTING_PATTERNS)
      b) ATS domain matching (ATS_JOB_DOMAINS)

    Parameters
    ----------
    careers_url : The listing page URL (e.g. https://jobs.zalando.com/en/jobs)
    max_jobs    : Cap on returned URLs to avoid overwhelming the pipeline.

    Returns
    -------
    List of absolute job-posting URLs, deduplicated, up to max_jobs.
    """
    try:
        from crawl4ai import AsyncWebCrawler, CacheMode
    except ImportError as exc:
        raise ImportError("crawl4ai not installed: pip install crawl4ai") from exc

    logger.info("Extracting job links from: %s", careers_url)

    async with AsyncWebCrawler(headless=True, verbose=False) as crawler:
        result = await crawler.arun(
            url=careers_url,
            cache_mode=CacheMode.BYPASS,
            remove_overlay_elements=True,
        )

    if not result.success:
        logger.warning("Crawl failed for %s: %s", careers_url, result.error_message)
        return []

    # Crawl4AI exposes extracted links in result.links
    all_links: list[str] = []
    for link in getattr(result, "links", {}).get("internal", []):
        url = link.get("href", "")
        if url:
            all_links.append(url)
    for link in getattr(result, "links", {}).get("external", []):
        url = link.get("href", "")
        if url:
            all_links.append(url)

    # Fall back to parsing the markdown for URLs if links dict is empty
    if not all_links and result.markdown:
        all_links = re.findall(r"https?://[^\s\)\"\']+", result.markdown)

    job_urls: list[str] = []
    seen: set[str] = set()

    for url in all_links:
        url = url.rstrip(".,)")
        if url in seen:
            continue
        if JOB_POSTING_PATTERNS.search(url) or ATS_JOB_DOMAINS.search(url):
            seen.add(url)
            job_urls.append(url)
        if len(job_urls) >= max_jobs:
            break

    logger.info("Found %d job links at %s", len(job_urls), careers_url)
    return job_urls


# ---------------------------------------------------------------------------
# Layer 4: New company discovery via DuckDuckGo
# ---------------------------------------------------------------------------

def discover_berlin_companies(
    query: str = "Berlin tech startup GmbH jobs 2024",
    max_results: int = 20,
    pause: float = 1.5,
) -> list[dict]:
    """
    Search DuckDuckGo for Berlin tech companies not already in seeds.json.

    Uses the `duckduckgo-search` library (no API key required).

    Returns a list of dicts:
        {"company": <guessed name>, "homepage": <url>, "city": "Berlin", "size": null}

    These are candidate entries -- they should be reviewed before being added
    to seeds.json. Use `first_run.py --discover` to trigger this automatically.
    """
    try:
        from duckduckgo_search import DDGS
    except ImportError as exc:
        raise ImportError(
            "duckduckgo-search not installed: pip install duckduckgo-search"
        ) from exc

    existing_homepages = {
        s["homepage"].rstrip("/") for s in load_seeds()
    }

    results = []
    with DDGS() as ddgs:
        hits = ddgs.text(query, region="de-de", max_results=max_results)
        for hit in hits:
            url = hit.get("href", "")
            title = hit.get("title", "")

            if not url:
                continue

            parsed = urlparse(url)
            homepage = "{scheme}://{netloc}".format(
                scheme=parsed.scheme, netloc=parsed.netloc
            )

            if homepage.rstrip("/") in existing_homepages:
                continue

            results.append({
                "company": title.split("|")[0].split("-")[0].strip(),
                "homepage": homepage,
                "city": "Berlin",
                "size": None,
                "careers_url": None,
            })

            existing_homepages.add(homepage.rstrip("/"))
            time.sleep(pause)  # be polite to DuckDuckGo

    logger.info("Discovered %d new candidate companies", len(results))
    return results


# ---------------------------------------------------------------------------
# Utility: append discovered companies to seeds.json
# ---------------------------------------------------------------------------

def append_to_seeds(new_companies: list[dict], path: Path = SEEDS_PATH) -> None:
    """Merge new_companies into seeds.json, avoiding homepage duplicates."""
    seeds = load_seeds(path)
    existing = {s["homepage"].rstrip("/") for s in seeds}

    added = 0
    for company in new_companies:
        if company["homepage"].rstrip("/") not in existing:
            seeds.append(company)
            existing.add(company["homepage"].rstrip("/"))
            added += 1

    with open(path, "w", encoding="utf-8") as f:
        json.dump(seeds, f, indent=2, ensure_ascii=False)

    logger.info("Appended %d new companies to %s", added, path)
