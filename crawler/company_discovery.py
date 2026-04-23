"""
company_discovery.py
====================
Automatically discover German tech companies from aggregator sources and seed
them into the companies table.

Sources
-------
1. berlinstartupjobs.com/companies/    — Berlin-focused startup directory
2. germanstartupjobs.com               — Germany-wide startup jobs board
3. boards.greenhouse.io                — Greenhouse ATS public board index
4. jobs.lever.co                       — Lever ATS public board index
5. jobs.ashbyhq.com                    — Ashby ATS public board index

Strategy
--------
For each source we:
  a) Fetch and parse the page with Crawl4AI (or HTTP for lightweight pages)
  b) Use DeepSeek to extract {name, homepage, job_board_url, city, size} tuples
  c) Normalise the company URL + name
  d) Upsert into the companies table via upsert_company_seed()
  e) Skip anything that doesn't look like a German / Berlin company

Usage
-----
    python main.py --discover-companies
    python main.py --discover-companies --limit 200
"""

import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import aiohttp
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))
from db import get_connection, upsert_company_seed
from utils.fetch import fetch_markdown
from utils.normalization import normalize_name, clean_url

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DeepSeek extraction
# ---------------------------------------------------------------------------

def _get_ai_client():
    from openai import OpenAI
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError("DEEPSEEK_API_KEY not set")
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")


_COMPANY_EXTRACT_PROMPT = """You are extracting a list of German tech companies from a web page.
Return a JSON array of company objects. Each object must have:
  - name: string — company display name
  - homepage: string — company homepage URL (https://...)
  - job_board_url: string — direct URL to their job/careers listings (may equal homepage/careers)
  - city: string — HQ city (e.g. "Berlin", "Hamburg", "Munich") or "Remote" if fully remote
  - size: string — one of: Micro | Startup | Mid-size | Enterprise (guess from context)
  - ats_type: string — one of: greenhouse | lever | ashby | workday | custom

Rules:
- Only include companies that are German, or have significant Berlin/Germany presence, or are remote-friendly for Germany
- If job_board_url is unknown, use homepage + "/careers" or "/jobs"
- If city is unclear, use "Berlin" for Berlin-focused sources
- Return ONLY the JSON array, nothing else. Example: [{"name":"Acme","homepage":"https://acme.de","job_board_url":"https://acme.de/jobs","city":"Berlin","size":"Startup","ats_type":"greenhouse"}]
- Return [] if no companies found on the page
"""


def _extract_companies_with_ai(markdown: str, source_hint: str = "") -> list[dict]:
    """Use DeepSeek to extract company data from markdown."""
    if not markdown or len(markdown.strip()) < 50:
        return []

    client = _get_ai_client()
    truncated = markdown[:12_000]

    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                temperature=0.0,
                max_tokens=4000,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _COMPANY_EXTRACT_PROMPT},
                    {"role": "user", "content": f"Source: {source_hint}\n\n{truncated}"},
                ],
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            # DeepSeek might wrap array in {"companies": [...]} or similar
            if isinstance(data, list):
                return data
            for key in ("companies", "results", "items", "data"):
                if isinstance(data.get(key), list):
                    return data[key]
            return []
        except json.JSONDecodeError as exc:
            logger.warning("AI JSON parse error (attempt %d): %s", attempt, exc)
        except Exception as exc:
            logger.error("AI API error (attempt %d): %s", attempt, exc)
    return []


# ---------------------------------------------------------------------------
# Lightweight HTTP fetch (no headless browser — for simple HTML pages)
# ---------------------------------------------------------------------------

async def _fetch_html(url: str, timeout: int = 15) -> str:
    """Fetch a URL with plain aiohttp and return the raw HTML text."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; BerlinJobHub/1.0; +https://berlinjobhub.de)"}
    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout), allow_redirects=True) as resp:
                if resp.status == 200:
                    return await resp.text()
                logger.warning("HTTP %d for %s", resp.status, url)
                return ""
    except Exception as exc:
        logger.warning("Fetch error for %s: %s", url, exc)
        return ""


# ---------------------------------------------------------------------------
# Simple HTML → text converter (avoids headless browser for listing pages)
# ---------------------------------------------------------------------------

def _html_to_text(html: str) -> str:
    """Strip HTML tags crudely — good enough for AI extraction."""
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;", " ", html)
    html = re.sub(r"&amp;", "&", html)
    html = re.sub(r"&lt;", "<", html)
    html = re.sub(r"&gt;", ">", html)
    html = re.sub(r"\s{3,}", "\n", html)
    return html.strip()


# ---------------------------------------------------------------------------
# Source scrapers
# ---------------------------------------------------------------------------

async def _discover_from_berlinstartupjobs() -> list[dict]:
    """
    berlinstartupjobs.com/companies/ lists Berlin startup companies.
    Multiple pages — we crawl the first several.
    """
    companies = []
    base = "https://berlinstartupjobs.com/companies/"
    pages = [base] + [f"{base}page/{i}/" for i in range(2, 8)]

    for url in pages:
        logger.info("berlinstartupjobs: crawling %s", url)
        html = await _fetch_html(url)
        if not html:
            break
        text = _html_to_text(html)
        found = _extract_companies_with_ai(text, source_hint="berlinstartupjobs.com companies directory")
        logger.info("berlinstartupjobs: found %d companies on %s", len(found), url)
        companies.extend(found)
        if not found:
            break
        await asyncio.sleep(2.0)

    return companies


async def _discover_from_germanstartupjobs() -> list[dict]:
    """
    germanstartupjobs.com — Germany-wide startup job board.
    Extract companies from the job listing pages.
    """
    companies = []
    urls = [
        "https://germanstartupjobs.com/jobs/",
        "https://germanstartupjobs.com/jobs/?page=2",
        "https://germanstartupjobs.com/jobs/?page=3",
    ]

    for url in urls:
        logger.info("germanstartupjobs: crawling %s", url)
        # This site needs JS rendering
        md = await fetch_markdown(url, wait_seconds=4.0)
        if not md:
            continue
        found = _extract_companies_with_ai(md, source_hint="germanstartupjobs.com job listings")
        logger.info("germanstartupjobs: found %d companies on %s", len(found), url)
        companies.extend(found)
        if not found:
            break
        await asyncio.sleep(3.0)

    return companies


async def _discover_from_greenhouse_directory(limit: int = 200) -> list[dict]:
    """
    Greenhouse has a public board directory at boards.greenhouse.io.
    We use their JSON API to get all active boards and filter for German companies.
    Endpoint: https://api.greenhouse.io/v1/boards  (no auth required for public list)
    """
    companies = []
    url = "https://api.greenhouse.io/v1/boards"
    logger.info("Greenhouse: fetching board directory from %s", url)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status != 200:
                    logger.warning("Greenhouse API returned %d", resp.status)
                    return []
                data = await resp.json()
    except Exception as exc:
        logger.error("Greenhouse directory fetch failed: %s", exc)
        return []

    boards = data if isinstance(data, list) else data.get("boards", [])
    logger.info("Greenhouse: %d total boards found", len(boards))

    # Filter: we look for companies whose name or URL hints at Germany/Berlin
    german_keywords = re.compile(
        r"\b(berlin|germany|german|deutschland|münchen|munich|hamburg|"
        r"köln|cologne|frankfurt|gmbh|ag\b|se\b|kg\b)\b",
        re.IGNORECASE,
    )

    candidate_boards = [b for b in boards if german_keywords.search(json.dumps(b))]
    logger.info("Greenhouse: %d potentially German boards", len(candidate_boards))

    # For each candidate, build a record
    for board in candidate_boards[:limit]:
        slug = board.get("token") or board.get("slug") or ""
        name = board.get("name", slug)
        if not slug:
            continue
        companies.append({
            "name": name,
            "homepage": f"https://{slug}.com",  # best-effort guess
            "job_board_url": f"https://boards.greenhouse.io/{slug}",
            "city": "Berlin",    # will be refined when jobs are crawled
            "size": "Startup",
            "ats_type": "greenhouse",
        })

    return companies


async def _discover_from_lever_directory(limit: int = 200) -> list[dict]:
    """
    Lever doesn't have a public directory API, but we can use their search/
    We check a curated list of German company slugs from common knowledge.
    """
    # Known German companies on Lever (slug → display name)
    known_lever_companies = {
        "n26": ("N26", "Berlin"),
        "taxfix": ("Taxfix", "Berlin"),
        "urbansportsclub": ("Urban Sports Club", "Berlin"),
        "civey": ("Civey", "Berlin"),
        "spryker": ("Spryker", "Berlin"),
        "gorillas": ("Gorillas", "Berlin"),
        "tier": ("Tier Mobility", "Berlin"),
        "sonnen": ("sonnen", "Berlin"),
        "parkhere": ("ParkHere", "Munich"),
        "infarm": ("Infarm", "Berlin"),
        "liqid": ("LIQID", "Berlin"),
        "truthbird": ("TruthBird", "Berlin"),
        "sennder": ("sennder", "Berlin"),
        "refurbed": ("Refurbed", "Vienna"),
        "heyjobs": ("HeyJobs", "Berlin"),
        "recharge": ("Recharge", "Berlin"),
        "humanitec": ("Humanitec", "Berlin"),
        "stravito": ("Stravito", "Berlin"),
        "getscrap": ("Scrap", "Berlin"),
        "lunchr": ("Lunchr", "Berlin"),
        "sumup": ("SumUp", "Berlin"),
        "blinkist": ("Blinkist", "Berlin"),
        "exporo": ("Exporo", "Hamburg"),
        "payhawk": ("Payhawk", "Berlin"),
        "personio": ("Personio", "Munich"),
        "forto": ("Forto", "Berlin"),
        "wundermobility": ("Wunder Mobility", "Hamburg"),
        "naga": ("NAGA", "Berlin"),
        "moonfare": ("Moonfare", "Berlin"),
        "frontrow": ("FrontRow", "Berlin"),
        "companisto": ("Companisto", "Berlin"),
        "mymuesli": ("mymuesli", "Passau"),
        "pricehubble": ("PriceHubble", "Berlin"),
        "comtravo": ("Comtravo", "Berlin"),
    }

    companies = []
    for slug, (name, city) in known_lever_companies.items():
        companies.append({
            "name": name,
            "homepage": f"https://{slug}.com",
            "job_board_url": f"https://jobs.lever.co/{slug}",
            "city": city,
            "size": "Startup",
            "ats_type": "lever",
        })

    logger.info("Lever: built %d company records from curated list", len(companies))
    return companies


async def _discover_from_ashby_directory() -> list[dict]:
    """Known German companies on Ashby ATS."""
    known_ashby = {
        "traderepublic": ("Trade Republic", "Berlin", "Mid-size"),
        "moss": ("Moss", "Berlin", "Startup"),
        "ostrom": ("Ostrom", "Berlin", "Startup"),
        "vara": ("Vara", "Berlin", "Startup"),
        "pitch": ("Pitch", "Berlin", "Startup"),
        "aleph-alpha": ("Aleph Alpha", "Heidelberg", "Startup"),
        "qdrant": ("Qdrant", "Berlin", "Startup"),
        "flowx-ai": ("FlowX AI", "Berlin", "Startup"),
        "brevo": ("Brevo", "Berlin", "Mid-size"),
        "sumup": ("SumUp Berlin", "Berlin", "Mid-size"),
        "personio": ("Personio", "Munich", "Mid-size"),
        "coachhub": ("CoachHub", "Berlin", "Startup"),
        "parkdepot": ("ParkDepot", "Munich", "Startup"),
    }

    companies = []
    for slug, (name, city, size) in known_ashby.items():
        companies.append({
            "name": name,
            "homepage": f"https://{slug}.com",
            "job_board_url": f"https://jobs.ashbyhq.com/{slug}",
            "city": city,
            "size": size,
            "ats_type": "ashby",
        })

    logger.info("Ashby: built %d company records", len(companies))
    return companies


async def _discover_from_berlin_startup_ecosystem() -> list[dict]:
    """
    Scrape additional aggregator sources:
    - startup-map.berlin (list of Berlin startups)
    - german.tech (German tech ecosystem)
    """
    companies = []
    sources = [
        ("https://startup-map.berlin/companies", "startup-map.berlin Berlin company list"),
        ("https://www.berlin-partner.de/en/invest/startups/", "Berlin Partner startup ecosystem"),
    ]

    for url, hint in sources:
        logger.info("Ecosystem: crawling %s", url)
        try:
            html = await _fetch_html(url, timeout=20)
            if html:
                text = _html_to_text(html)
                found = _extract_companies_with_ai(text, source_hint=hint)
                logger.info("Ecosystem: found %d companies from %s", len(found), url)
                companies.extend(found)
        except Exception as exc:
            logger.warning("Ecosystem source %s failed: %s", url, exc)
        await asyncio.sleep(2.0)

    return companies


# ---------------------------------------------------------------------------
# Validation and deduplication
# ---------------------------------------------------------------------------

_GERMAN_TLD_RE = re.compile(r"\.(de|at|ch|eu)(/|$)")
_GERMAN_CITY_RE = re.compile(
    r"\b(berlin|hamburg|munich|münchen|cologne|köln|frankfurt|düsseldorf|"
    r"stuttgart|dortmund|essen|Leipzig|Bremen|Hannover|Dresden|Heidelberg|"
    r"Augsburg|Nürnberg|Nuremberg|Bonn|Karlsruhe|Münster)\b",
    re.IGNORECASE,
)


def _looks_german(company: dict) -> bool:
    """Return True if this company is likely German / Berlin-relevant."""
    text = json.dumps(company)
    if _GERMAN_CITY_RE.search(text):
        return True
    if _GERMAN_TLD_RE.search(company.get("homepage", "")):
        return True
    if _GERMAN_TLD_RE.search(company.get("job_board_url", "")):
        return True
    return False


def _validate_company(raw: dict) -> dict | None:
    """Validate and normalise a raw company dict. Returns None if invalid."""
    name = str(raw.get("name") or "").strip()
    homepage = str(raw.get("homepage") or "").strip()
    job_board_url = str(raw.get("job_board_url") or "").strip()

    if not name or len(name) < 2:
        return None
    if not homepage or not homepage.startswith("http"):
        return None

    # Normalise
    homepage = clean_url(homepage)
    if not job_board_url or not job_board_url.startswith("http"):
        job_board_url = homepage + "/careers"
    else:
        job_board_url = job_board_url.rstrip("/")

    city = str(raw.get("city") or "Berlin").strip()
    size = raw.get("size", "Startup")
    if size not in ("Micro", "Startup", "Mid-size", "Enterprise"):
        size = "Startup"
    ats_type = raw.get("ats_type", "custom")
    if ats_type not in ("greenhouse", "lever", "ashby", "workday", "custom"):
        ats_type = "custom"

    return {
        "name": name,
        "normalized_name": normalize_name(name),
        "homepage_url": homepage,
        "job_board_url": job_board_url,
        "hq_city": city,
        "company_size": size,
        "ats_type": ats_type,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def discover_companies(limit: int | None = None) -> int:
    """
    Run all discovery sources and upsert results into the DB.
    Returns the number of companies successfully upserted.
    """
    logger.info("Starting company discovery across all sources...")

    # Gather raw results from all sources concurrently (where safe)
    results = await asyncio.gather(
        _discover_from_berlinstartupjobs(),
        _discover_from_lever_directory(),
        _discover_from_ashby_directory(),
        _discover_from_berlin_startup_ecosystem(),
        return_exceptions=True,
    )

    # Greenhouse directory is rate-sensitive — run sequentially
    try:
        greenhouse = await _discover_from_greenhouse_directory(limit=limit or 300)
    except Exception as exc:
        logger.error("Greenhouse directory failed: %s", exc)
        greenhouse = []

    # Flatten results
    all_raw = greenhouse[:]
    for r in results:
        if isinstance(r, list):
            all_raw.extend(r)
        elif isinstance(r, Exception):
            logger.error("Source error: %s", r)

    logger.info("Total raw company records collected: %d", len(all_raw))

    # Run germanstartupjobs sequentially (needs headless browser)
    try:
        gsj = await _discover_from_germanstartupjobs()
        all_raw.extend(gsj)
    except Exception as exc:
        logger.error("germanstartupjobs discovery failed: %s", exc)

    logger.info("Total after all sources: %d raw records", len(all_raw))

    # Validate, filter, and deduplicate
    seen_urls = set()
    seen_names = set()
    valid = []
    for raw in all_raw:
        company = _validate_company(raw)
        if not company:
            continue
        if not _looks_german(company) and company.get("hq_city", "").lower() not in ("berlin",):
            logger.debug("Skipping non-German company: %s", company["name"])
            continue
        key = company["homepage_url"]
        if key in seen_urls:
            continue
        seen_urls.add(key)
        valid.append(company)

    logger.info("Valid unique companies after filtering: %d", len(valid))

    if limit:
        valid = valid[:limit]

    # Upsert into DB
    saved = 0
    with get_connection() as conn:
        for company in valid:
            try:
                upsert_company_seed(
                    conn,
                    name=company["name"],
                    normalized_name=company["normalized_name"],
                    homepage_url=company["homepage_url"],
                    job_board_url=company["job_board_url"],
                    ats_type=company["ats_type"],
                    company_size=company["company_size"],
                    hq_city=company["hq_city"],
                )
                saved += 1
            except Exception as exc:
                logger.error("Failed to upsert %r: %s", company["name"], exc)

    logger.info("Company discovery complete: %d companies upserted.", saved)
    return saved
