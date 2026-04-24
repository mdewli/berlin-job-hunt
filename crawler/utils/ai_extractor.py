"""
ai_extractor.py
===============
Uses the DeepSeek API (OpenAI-compatible) to extract structured job data
from a scraped Markdown string.

Returned schema
---------------
{
    "title":                str,   # Job title
    "location_raw":         str,   # Exact role location from the posting
    "role_category":        str,   # One of ROLE_CATEGORIES
    "tech_stack":           list,  # ["Python", "PostgreSQL", "dbt"]
    "languages":            dict,  # {"german": "B2", "english": "C1"}
    "is_berlin_compatible": bool,
    "remote_type":          str,   # "Full-Remote" | "Hybrid" | "On-site"
}
"""

import json
import logging
import os
import re
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Taxonomy
# ---------------------------------------------------------------------------
ROLE_CATEGORIES = [
    "Backend", "Frontend", "Full-Stack",
    "Data Science", "Data Engineering", "Machine Learning / AI",
    "DevOps / SRE", "Mobile", "Product", "Design",
    "QA / Testing", "Security", "Management",
    "Sales / Marketing", "Operations", "Other",
]

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """You are a structured data extractor for a Berlin tech job board.
Given the Markdown of a single job posting page, return ONE raw JSON object.
No prose, no markdown fences, no explanation — only the JSON.

════════════════════════════════════════════════════════
FIELD 1 — title  (string)
════════════════════════════════════════════════════════
The job title as written in the posting.
Rules:
• Look first at the page <title>, the first H1, or the first H2.
• Strip company name suffixes: "Senior Engineer | Zalando" → "Senior Engineer"
• Remove gender suffixes: (m/f/d), (m/w/d), (all genders)
• If the page has no recognisable job title (cookie wall, 404, redirect) → "Unknown"

════════════════════════════════════════════════════════
FIELD 2 — location_raw  (string)
════════════════════════════════════════════════════════
The EXACT location of THIS SPECIFIC ROLE — not the company headquarters.

Look for sections labelled: "Location", "Where you'll work", "Office",
"Job location", "Standort", "Arbeitsort", "Einsatzort".

⚠️  CRITICAL: Many global companies mention their Berlin HQ in the company
description. DO NOT use that as the job location. Only use the location
explicitly stated for this role.

Examples:
  "Berlin, Germany"          ← correct for a Berlin role
  "Toronto, Canada"          ← correct for a Canada role
  "Remote (Germany only)"    ← correct for Germany-remote
  "Hybrid — Berlin"          ← correct for hybrid Berlin
  "New York, USA"            ← correct for a US role
  "Worldwide Remote"         ← correct for fully global remote

If no specific role location is stated → "Not specified"

════════════════════════════════════════════════════════
FIELD 3 — role_category  (string, pick exactly ONE)
════════════════════════════════════════════════════════
Backend            → Software Engineer, Backend Developer, Python Developer, Java Engineer
Frontend           → Frontend Developer, React Engineer, UI Engineer, Vue Developer
Full-Stack         → Full-Stack Developer, Web Developer
Data Science       → Data Scientist, Data Analyst, BI Analyst, Analytics Engineer
Data Engineering   → Data Engineer, ETL Developer, dbt Developer, Spark Engineer
Machine Learning / AI → ML Engineer, AI Engineer, NLP Engineer, Research Scientist
DevOps / SRE       → DevOps Engineer, SRE, Cloud Engineer, Kubernetes Engineer
Mobile             → iOS Developer, Android Developer, React Native, Flutter
Product            → Product Manager, Product Owner, Product Analyst
Design             → UX Designer, UI Designer, Product Designer, UX Researcher
QA / Testing       → QA Engineer, Test Engineer, SDET
Security           → Security Engineer, Penetration Tester, AppSec
Management         → Engineering Manager, VP Engineering, CTO, Tech Lead
Sales / Marketing  → Sales Engineer, Growth Manager, Marketing Analyst
Operations         → Operations Manager, Business Analyst, Project Manager
Other              → anything that does not fit above

════════════════════════════════════════════════════════
FIELD 4 — tech_stack  (array of strings)
════════════════════════════════════════════════════════
All technologies mentioned: languages, frameworks, databases, cloud, DevOps tools.
Capitalise consistently:
  python→Python  javascript→JavaScript  typescript→TypeScript  golang→Go
  react→React  vue→Vue.js  angular→Angular  django→Django  fastapi→FastAPI
  postgresql→PostgreSQL  mysql→MySQL  mongodb→MongoDB  redis→Redis
  kafka→Kafka  spark→Apache Spark  dbt→dbt  airflow→Apache Airflow
  aws→AWS  gcp→GCP  azure→Azure  kubernetes→Kubernetes  docker→Docker
  terraform→Terraform  pytorch→PyTorch  tensorflow→TensorFlow
Scan ALL sections including nice-to-haves. Return [] only if ZERO technologies.

════════════════════════════════════════════════════════
FIELD 5 — languages  (object: language → CEFR level)
════════════════════════════════════════════════════════
Keys are lowercase language names. Values are CEFR: A1 A2 B1 B2 C1 C2.

ENGLISH:
• Posting written in English → "english": "C1" (unless explicit level stated)
• "English is a plus / beneficial" → "english": "B1"

GERMAN — HARD REQUIREMENT (use "C1" if no level stated):
  "Deutsch erforderlich", "German required", "fluent German", "German C1/B2",
  posting is entirely in German.
GERMAN — OPTIONAL ("A2"):
  "Deutsch von Vorteil", "German is a plus", "nice to have", "Grundkenntnisse"
NOT MENTIONED → omit "german" entirely.

════════════════════════════════════════════════════════
FIELD 6 — is_berlin_compatible  (boolean)
════════════════════════════════════════════════════════
TRUE only if a person living in BERLIN could do this job without relocating:
  ✓ location_raw contains "Berlin"
  ✓ location_raw is a Brandenburg city (Potsdam, Oranienburg, Falkensee, Teltow, …)
  ✓ Full-Remote role with no country restriction OR restricted to Germany/Deutschland
  ✓ Mentions "bundesweit", "deutschlandweit", "germany-wide", "remote from Germany"
  ✓ Location not specified AND posting is in German (likely German market)

FALSE — even if the company is based in Berlin:
  ✗ location_raw is a specific non-Berlin city: Hamburg, Munich, Frankfurt,
    Cologne, Stuttgart, Düsseldorf, Vienna, Zurich, etc.
  ✗ location_raw is outside Germany: "Toronto, Canada", "New York, USA",
    "London, UK", "Amsterdam, Netherlands", "Sydney, Australia"
  ✗ Remote role explicitly restricted to another country:
    "Remote (Canada only)", "US remote", "Remote - UK residents only"

⚠️  COMMON MISTAKE: A company like HelloFresh, Delivery Hero, or Zalando may
say "We are headquartered in Berlin" in their About section — this does NOT
make a role Berlin-compatible if the role itself is located in Canada or the US.
Base your answer ONLY on location_raw, not on the company description.

════════════════════════════════════════════════════════
FIELD 7 — remote_type  (string)
════════════════════════════════════════════════════════
"Full-Remote"  → 100% remote, no office attendance required
"Hybrid"       → mix of remote + office days (or ambiguous)
"On-site"      → office only, no remote option
Default to "Hybrid" when unclear.

════════════════════════════════════════════════════════
OUTPUT — return ONLY this JSON shape:
{
  "title": "...",
  "location_raw": "...",
  "role_category": "...",
  "tech_stack": ["...", "..."],
  "languages": {"english": "C1", "german": "B2"},
  "is_berlin_compatible": true,
  "remote_type": "Hybrid"
}
"""

# ---------------------------------------------------------------------------
# Post-processing regexes
# ---------------------------------------------------------------------------

# Strong Germany-remote signals — safe to use as override
_GERMANY_REMOTE_RE = re.compile(
    r"\b(bundesweit|germany.?wide|deutschlandweit|"
    r"remote\s+(?:from|in|within|across)\s+(?:germany|deutschland)|"
    r"work\s+from\s+(?:anywhere\s+in\s+)?(?:germany|deutschland)|"
    r"anywhere\s+in\s+germany|remote\s*\(?\s*germany\s*\)?|"
    r"remote\s+or\s+berlin|berlin\s+or\s+remote|"
    r"full.?remote.*germany|germany.*full.?remote)\b",
    re.IGNORECASE,
)

# Non-Germany country signals — used to override false positives
_NON_GERMANY_RE = re.compile(
    r"\b(canada|united states|u\.s\.a?|united kingdom|u\.k\.|"
    r"australia|new zealand|singapore|india|"
    r"toronto|vancouver|new york|san francisco|london|amsterdam|"
    r"paris|sydney|bangalore|dublin)\b",
    re.IGNORECASE,
)

_ENGLISH_WORDS_RE = re.compile(
    r"\b(the|and|you|will|our|team|we|are|have|with|your|for|this|that|"
    r"about|role|position|experience|skills|requirements|responsibilities)\b",
    re.IGNORECASE,
)

_GERMAN_WORDS_RE = re.compile(
    r"\b(wir|sie|ihr|und|oder|mit|für|die|das|der|ein|eine|werden|suchen|"
    r"bieten|stellen|kenntnisse|erfahrung|anforderungen)\b",
    re.IGNORECASE,
)

_GENDER_SUFFIX_RE = re.compile(
    r"\s*[\(\[]?\s*(?:m|f|d|w|x|all genders?|alle geschlechter|m/w/d|m/f/d|"
    r"m/f/x|w/m/d|f/m/d|all|diverse)\s*[\)\]]?\s*$",
    re.IGNORECASE,
)


def _is_english_dominant(text: str) -> bool:
    sample = text[:2000]
    words  = len(sample.split())
    if words < 20:
        return False
    en = len(_ENGLISH_WORDS_RE.findall(sample))
    de = len(_GERMAN_WORDS_RE.findall(sample))
    return en > de and (en / words) > 0.04


def _is_german_dominant(text: str) -> bool:
    sample = text[:2000]
    words  = len(sample.split())
    if words < 20:
        return False
    de = len(_GERMAN_WORDS_RE.findall(sample))
    en = len(_ENGLISH_WORDS_RE.findall(sample))
    return de > en and (de / words) > 0.04


def _clean_title(title: str) -> str:
    for sep in [" | ", " — ", " – ", " at ", " @ "]:
        if sep in title:
            title = title.split(sep)[0].strip()
    title = _GENDER_SUFFIX_RE.sub("", title).strip()
    return title or "Unknown"


# ---------------------------------------------------------------------------
# DeepSeek client
# ---------------------------------------------------------------------------

def _get_client() -> OpenAI:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError("DEEPSEEK_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_job_data(markdown: str, model: str = "deepseek-chat") -> dict[str, Any]:
    """
    Send markdown to DeepSeek and return a structured job-data dict.
    Falls back to safe defaults if the markdown is too short.
    """
    if not markdown or not markdown.strip():
        logger.warning("extract_job_data: empty markdown — returning defaults.")
        return _default_result()

    if len(markdown.strip()) < 100:
        logger.warning(
            "extract_job_data: markdown too short (%d chars) — likely a cookie "
            "wall or redirect. Returning defaults.", len(markdown.strip())
        )
        return _default_result()

    truncated = markdown[:14_000]
    client    = _get_client()

    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0.0,
                max_tokens=700,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": truncated},
                ],
            )
            raw_json = response.choices[0].message.content
            result   = json.loads(raw_json)
            return _validate_and_coerce(result, markdown)

        except json.JSONDecodeError as exc:
            logger.warning("Attempt %d: JSON parse error: %s", attempt, exc)
            if attempt == 3:
                logger.error("DeepSeek returned invalid JSON 3×; using defaults.")
                return _default_result()

        except Exception as exc:
            logger.error("Attempt %d: API error: %s", attempt, exc)
            if attempt == 3:
                logger.error("DeepSeek API failed 3×; using defaults.")
                return _default_result()

    return _default_result()


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------

def _validate_and_coerce(data: dict, original_markdown: str) -> dict:
    """Apply safety nets and normalise the model's raw output."""

    # ── title ────────────────────────────────────────────────────────────────
    raw_title = str(data.get("title", "") or "").strip()
    data["title"] = "Unknown" if not raw_title or raw_title.lower() == "unknown" \
                    else _clean_title(raw_title)

    # ── location_raw ─────────────────────────────────────────────────────────
    location_raw = str(data.get("location_raw", "") or "").strip()
    if not location_raw or location_raw.lower() in ("none", "null", "n/a"):
        location_raw = "Not specified"
    data["location_raw"] = location_raw

    # ── role_category ────────────────────────────────────────────────────────
    if data.get("role_category") not in ROLE_CATEGORIES:
        data["role_category"] = "Other"

    # ── tech_stack ───────────────────────────────────────────────────────────
    stack = data.get("tech_stack", [])
    if not isinstance(stack, list):
        stack = []
    data["tech_stack"] = [str(t).strip() for t in stack if t]

    # ── languages ────────────────────────────────────────────────────────────
    langs = data.get("languages", {})
    if not isinstance(langs, dict):
        langs = {}
    langs = {
        k.lower().strip(): v.upper().strip()
        for k, v in langs.items()
        if isinstance(v, str) and v.upper().strip() in CEFR_LEVELS
    }
    if "english" not in langs and _is_english_dominant(original_markdown):
        langs["english"] = "C1"
    if "german" not in langs and _is_german_dominant(original_markdown):
        langs["german"] = "C1"
    data["languages"] = langs

    # ── is_berlin_compatible ─────────────────────────────────────────────────
    # Primary signal: model judgment (it now has location_raw to reason from)
    model_flag = bool(data.get("is_berlin_compatible", False))

    # Override #1: strong Germany-remote signal in page text → force True
    # (model sometimes misses these phrases buried in job descriptions)
    germany_remote_signal = bool(_GERMANY_REMOTE_RE.search(original_markdown))

    # Override #2: explicit non-Germany location in location_raw → force False
    # This catches "Berlin HQ" in company bio but Canadian job location
    location_in_non_germany = bool(_NON_GERMANY_RE.search(location_raw))

    if location_in_non_germany:
        # Hard reject: role is explicitly outside Germany
        data["is_berlin_compatible"] = False
    elif germany_remote_signal and not location_in_non_germany:
        # Germany-remote confirmed in page text
        data["is_berlin_compatible"] = True
    else:
        # Trust the model
        data["is_berlin_compatible"] = model_flag

    # ── remote_type ──────────────────────────────────────────────────────────
    if data.get("remote_type") not in ("Full-Remote", "Hybrid", "On-site"):
        data["remote_type"] = "Hybrid"

    return data


def _default_result() -> dict:
    return {
        "title":                "Unknown",
        "location_raw":         "Not specified",
        "role_category":        "Other",
        "tech_stack":           [],
        "languages":            {},
        "is_berlin_compatible": False,
        "remote_type":          "Hybrid",
    }
