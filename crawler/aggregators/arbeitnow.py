"""
aggregators/arbeitnow.py
========================
Pulls job listings from the Arbeitnow.de public API — a free, well-maintained
aggregator that covers the entire German market.

API docs: https://www.arbeitnow.com/api

Why Arbeitnow?
--------------
Arbeitnow aggregates postings from hundreds of companies including Google,
Apple, Amazon, SAP, Siemens, Booking.com, and every Berlin startup that posts
on job boards. A single paginated API call gives you the full German market
without needing to crawl each company's board individually.

What we get per job
-------------------
  slug          — unique identifier on arbeitnow
  company_name  — display name of the hiring company
  title         — job title
  description   — full HTML/text job description
  remote        — boolean
  url           — direct apply URL (the actual company / ATS page)
  tags          — list of skill tags e.g. ["Python", "Django"]
  location      — free-text location string
  created_at    — Unix timestamp

Strategy
--------
1. Hit GET /api/job-board-api?page=N in a loop until no more results.
2. Filter: keep only jobs where location mentions Berlin, Potsdam, or is remote.
3. For each job, upsert the company (auto-discovered from company_name) and
   the job posting. We use the Arbeitnow job URL as apply_url.
4. Use the tags field directly as tech_stack (no AI extraction needed for that).
5. Run a lightweight AI pass only for language detection on the description.
"""

import asyncio
import logging
import re
import sys
from pathlib import Path
from typing import Any

import aiohttp

sys.path.insert(0, str(Path(__file__).parent.parent))
from db import get_connection, save_job
from utils.normalization import normalize_name, clean_url
from utils.ai_extractor import extract_job_data

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ARBEITNOW_API = "https://www.arbeitnow.com/api/job-board-api"
MAX_PAGES     = 20          # each page has ~100 jobs → up to 2 000 postings
REQUEST_DELAY = 1.5         # seconds between pages (be polite)

# Location patterns that indicate a Berlin/Potsdam/Remote-Germany role
_BERLIN_RE = re.compile(
    r"\b(berlin|potsdam|brandenb|remote.*germany|germany.*remote|"
    r"deutschlandweit|bundesweit|germany.?wide|remote\s*\(de\)|"
    r"remote\s*\(germany\)|work from.*germany|anywhere in germany)\b",
    re.IGNORECASE,
)

# Heuristic: if location is just "Remote" with no country, include it
# (Arbeitnow is a German platform so unlabelled Remote is typically Germany)
_GENERIC_REMOTE_RE = re.compile(r"^\s*remote\s*$", re.IGNORECASE)


def _is_berlin_compatible(job: dict) -> bool:
    location = job.get("location", "") or ""
    remote   = bool(job.get("remote", False))

    if _BERLIN_RE.search(location):
        return True
    if remote and (not location or _GENERIC_REMOTE_RE.match(location)):
        return True
    return False


# ---------------------------------------------------------------------------
# Lightweight language detection from description
# (avoids a full AI round-trip — we already have the description text)
# ---------------------------------------------------------------------------

_GERMAN_WORDS_RE = re.compile(
    r"\b(wir|sie|ihr|und|oder|mit|für|die|das|der|ein|eine|werden|suchen|"
    r"bieten|stellen|kenntnisse|erfahrung|anforderungen|bewerben|stelle|"
    r"stellenanzeige|vollzeit|teilzeit|unbefristet|deutschkenntnisse)\b",
    re.IGNORECASE,
)
_ENGLISH_WORDS_RE = re.compile(
    r"\b(the|and|you|will|our|team|we|are|have|with|your|for|this|that|"
    r"about|role|position|experience|skills|requirements|responsibilities|"
    r"apply|candidate|opportunity)\b",
    re.IGNORECASE,
)
_GERMAN_REQUIRED_RE = re.compile(
    r"(german.{0,20}required|german.{0,20}must|deutsch.{0,20}erforderlich|"
    r"fließend.{0,20}deutsch|native.{0,20}german|muttersprachlich.{0,20}deutsch|"
    r"german\s*c[12]|german\s*b[12])",
    re.IGNORECASE,
)
_GERMAN_NICE_RE = re.compile(
    r"(german.{0,20}(plus|nice|benefit|advantage|bonus|vorteil|wünschenswert)|"
    r"(plus|nice|benefit|advantage|vorteil|wünschenswert).{0,20}german|"
    r"basic german|some german|grundkenntnisse deutsch)",
    re.IGNORECASE,
)


def _detect_languages(description: str) -> dict:
    """
    Heuristic language detection from description text.
    Returns e.g. {"english": "C1"} or {"german": "C1", "english": "C1"}.
    Does NOT call the DeepSeek API — fast and free.
    """
    if not description:
        return {"english": "C1"}

    sample = description[:3000]
    words  = len(sample.split())
    if words < 10:
        return {"english": "C1"}

    en_hits = len(_ENGLISH_WORDS_RE.findall(sample))
    de_hits = len(_GERMAN_WORDS_RE.findall(sample))

    langs: dict[str, str] = {}

    # English: present in almost all German tech postings in English
    if en_hits > 5 or (words > 0 and en_hits / words > 0.03):
        langs["english"] = "C1"

    # German: posting text is predominantly German
    if de_hits > en_hits and (words > 0 and de_hits / words > 0.04):
        langs["english"] = langs.get("english", "B2")
        if _GERMAN_REQUIRED_RE.search(sample):
            langs["german"] = "C1"
        else:
            langs["german"] = "C1"   # German-language posting = German required

    # German explicitly required even in English posting
    elif _GERMAN_REQUIRED_RE.search(sample):
        langs["german"] = "C1"

    # German nice-to-have
    elif _GERMAN_NICE_RE.search(sample):
        langs["german"] = "A2"

    if not langs:
        langs["english"] = "C1"

    return langs


# ---------------------------------------------------------------------------
# Role category from title + tags
# ---------------------------------------------------------------------------

_ROLE_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(backend|back-end|back end|java|python dev|django|fastapi|api dev|server.side)\b", re.I), "Backend"),
    (re.compile(r"\b(frontend|front-end|front end|react|vue|angular|ui eng|ux eng)\b", re.I), "Frontend"),
    (re.compile(r"\b(full.?stack|fullstack)\b", re.I), "Full-Stack"),
    (re.compile(r"\b(data scien|data analyst|business intel|bi dev|analytics eng)\b", re.I), "Data Science"),
    (re.compile(r"\b(data eng|etl|dbt dev|spark eng|pipeline|data infra)\b", re.I), "Data Engineering"),
    (re.compile(r"\b(machine learn|ml eng|ai eng|nlp|computer vision|research sci|applied sci|llm)\b", re.I), "Machine Learning / AI"),
    (re.compile(r"\b(devops|sre|site reliab|cloud eng|infra eng|platform eng|kubernetes|k8s)\b", re.I), "DevOps / SRE"),
    (re.compile(r"\b(ios|android|flutter|react native|mobile dev)\b", re.I), "Mobile"),
    (re.compile(r"\b(product manager|product owner|pm |p\.m\.|product lead)\b", re.I), "Product"),
    (re.compile(r"\b(ux|ui design|product design|ux research)\b", re.I), "Design"),
    (re.compile(r"\b(qa |test eng|sdet|quality assur|automation test)\b", re.I), "QA / Testing"),
    (re.compile(r"\b(security eng|penetration|appsec|infosec|cybersec)\b", re.I), "Security"),
    (re.compile(r"\b(engineering manager|vp eng|cto|tech lead)\b", re.I), "Management"),
    (re.compile(r"\b(sales eng|growth|marketing analyst|seo|sem)\b", re.I), "Sales / Marketing"),
    (re.compile(r"\b(operations|biz ops|project manag|scrum master|program manag)\b", re.I), "Operations"),
]


def _infer_role_category(title: str, tags: list[str]) -> str:
    combined = f"{title} {' '.join(tags)}"
    for pattern, category in _ROLE_MAP:
        if pattern.search(combined):
            return category
    return "Other"


# ---------------------------------------------------------------------------
# Company normalisation helpers
# ---------------------------------------------------------------------------

def _homepage_guess(company_name: str) -> str:
    """
    Best-effort homepage URL for a company name.
    For well-known companies we return the real URL; otherwise we guess.
    """
    known: dict[str, str] = {
        "google": "https://google.com",
        "apple": "https://apple.com",
        "amazon": "https://amazon.com",
        "microsoft": "https://microsoft.com",
        "meta": "https://meta.com",
        "spotify": "https://spotify.com",
        "booking.com": "https://booking.com",
        "sap": "https://sap.com",
        "siemens": "https://siemens.com",
        "bosch": "https://bosch.com",
        "bmw": "https://bmw.com",
        "volkswagen": "https://volkswagen.com",
        "mercedes-benz": "https://mercedes-benz.com",
        "deutsche telekom": "https://telekom.com",
        "telefonica": "https://telefonica.de",
        "axel springer": "https://axelspringer.com",
        "bayer": "https://bayer.com",
        "basf": "https://basf.com",
        "allianz": "https://allianz.com",
        "commerzbank": "https://commerzbank.de",
        "deutsche bank": "https://db.com",
        "dhl": "https://dhl.com",
        "lufthansa": "https://lufthansa.com",
    }
    norm = company_name.lower().strip()
    for key, url in known.items():
        if key in norm:
            return url
    # Slug-guess: take first word, lowercase, strip punctuation
    slug = re.sub(r"[^a-z0-9]", "", norm.split()[0]) if norm.split() else "unknown"
    return f"https://{slug}.com"


def _company_size_guess(company_name: str) -> str:
    enterprise_keywords = re.compile(
        r"\b(google|apple|amazon|microsoft|meta|sap|siemens|bosch|bmw|vw|"
        r"volkswagen|mercedes|telekom|lufthansa|deutsche bank|allianz|dhl|"
        r"bayer|basf|commerzbank|booking|spotify|zalando|delivery hero)\b",
        re.IGNORECASE,
    )
    if enterprise_keywords.search(company_name):
        return "Enterprise"
    return "Startup"


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------

async def _fetch_page(session: aiohttp.ClientSession, page: int) -> list[dict]:
    url = f"{ARBEITNOW_API}?page={page}"
    headers = {"Accept": "application/json", "User-Agent": "BerlinJobHunt/1.0"}
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("data", [])
            logger.warning("Arbeitnow API page %d returned HTTP %d", page, resp.status)
            return []
    except Exception as exc:
        logger.error("Arbeitnow page %d fetch error: %s", page, exc)
        return []


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_arbeitnow_jobs(max_pages: int = MAX_PAGES) -> int:
    """
    Fetch jobs from Arbeitnow, filter for Berlin/Remote-Germany, and upsert
    companies + job_postings into the database.

    Returns the number of jobs successfully saved.
    """
    logger.info("Arbeitnow: starting fetch (max %d pages)...", max_pages)
    total_seen = 0
    total_saved = 0
    total_skipped_location = 0

    async with aiohttp.ClientSession() as session:
        for page in range(1, max_pages + 1):
            logger.info("Arbeitnow: fetching page %d/%d", page, max_pages)
            jobs = await _fetch_page(session, page)

            if not jobs:
                logger.info("Arbeitnow: empty page %d — stopping.", page)
                break

            total_seen += len(jobs)

            for job in jobs:
                # ── Geography filter ─────────────────────────────────────────
                if not _is_berlin_compatible(job):
                    total_skipped_location += 1
                    continue

                # ── Extract fields ───────────────────────────────────────────
                title        = (job.get("title") or "").strip()
                company_name = (job.get("company_name") or "Unknown Company").strip()
                apply_url    = (job.get("url") or "").strip()
                description  = (job.get("description") or "")
                tags         = [t.strip() for t in (job.get("tags") or []) if t]
                location     = (job.get("location") or "").strip()
                remote       = bool(job.get("remote", False))

                if not title or not apply_url:
                    continue

                # ── Derive fields ────────────────────────────────────────────
                languages      = _detect_languages(description)
                role_category  = _infer_role_category(title, tags)
                remote_type    = "Full-Remote" if remote else "Hybrid"
                homepage       = clean_url(_homepage_guess(company_name))
                normalized     = normalize_name(company_name)
                company_size   = _company_size_guess(company_name)

                # Berlin compatible — we already filtered above
                is_in_berlin = True

                # ── Save to DB ───────────────────────────────────────────────
                try:
                    save_job(
                        company_name=company_name,
                        normalized_name=normalized,
                        homepage_url=homepage,
                        company_size=company_size,
                        hq_city=location or "Remote",
                        title=title,
                        apply_url=apply_url,
                        description=description[:500],   # store first 500 chars
                        languages=languages,
                        tech_stack=tags,
                        remote_type=remote_type,
                        is_in_berlin=is_in_berlin,
                        role_category=role_category,
                    )
                    total_saved += 1
                except Exception as exc:
                    logger.error("Failed to save '%s' @ %s: %s", title, company_name, exc)

            logger.info(
                "Page %d: %d jobs processed, %d saved so far",
                page, len(jobs), total_saved,
            )
            await asyncio.sleep(REQUEST_DELAY)

    logger.info(
        "Arbeitnow complete: %d total seen, %d location-filtered, %d saved.",
        total_seen, total_skipped_location, total_saved,
    )
    return total_saved
