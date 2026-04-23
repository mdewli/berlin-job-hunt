"""
ai_extractor.py
===============
Uses the DeepSeek API (OpenAI-compatible) to extract structured job data
from a scraped Markdown string.

Returned schema
---------------
{
    "title":                str,   # Job title, e.g. "Senior Backend Engineer"
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
    "Backend",
    "Frontend",
    "Full-Stack",
    "Data Science",
    "Data Engineering",
    "Machine Learning / AI",
    "DevOps / SRE",
    "Mobile",
    "Product",
    "Design",
    "QA / Testing",
    "Security",
    "Management",
    "Sales / Marketing",
    "Operations",
    "Other",
]

CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

# ---------------------------------------------------------------------------
# System prompt — verbose and example-rich for reliability
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
• Strip company name suffixes from page titles:
    "Senior Backend Engineer | Zalando"  →  "Senior Backend Engineer"
    "Data Analyst (m/f/d) — HelloFresh"  →  "Data Analyst"
    "(Senior) ML Engineer"               →  "ML Engineer"
• The gender suffix (m/f/d), (m/w/d), (all genders) is noise — remove it.
• If the page has no recognisable job title (cookie wall, 404, redirect),
  return "Unknown". Otherwise NEVER return "Unknown".

════════════════════════════════════════════════════════
FIELD 2 — role_category  (string, pick exactly ONE)
════════════════════════════════════════════════════════
Categories and example titles:

Backend            → Software Engineer, Backend Developer, Python Developer,
                     Java Engineer, API Developer, Platform Engineer (non-infra)
Frontend           → Frontend Developer, React Engineer, UI Engineer, Vue Developer
Full-Stack         → Full-Stack Developer, Web Developer, Software Engineer (Full-Stack)
Data Science       → Data Scientist, Data Analyst, Business Intelligence Analyst,
                     Analytics Engineer, BI Developer
Data Engineering   → Data Engineer, ETL Developer, Analytics Engineer (pipelines),
                     dbt Developer, Spark Engineer
Machine Learning / AI → ML Engineer, AI Engineer, NLP Engineer, Computer Vision,
                     Research Scientist, Applied Scientist
DevOps / SRE       → DevOps Engineer, SRE, Cloud Engineer, Infrastructure Engineer,
                     Platform Engineer (infra), Kubernetes Engineer
Mobile             → iOS Developer, Android Developer, React Native, Flutter
Product            → Product Manager, Product Owner, Product Analyst
Design             → UX Designer, UI Designer, Product Designer, UX Researcher
QA / Testing       → QA Engineer, Test Engineer, SDET, Quality Assurance
Security           → Security Engineer, Penetration Tester, AppSec, InfoSec
Management         → Engineering Manager, VP Engineering, CTO, Tech Lead
Sales / Marketing  → Sales Engineer, Growth Manager, Marketing Analyst
Operations         → Operations Manager, Business Analyst, Project Manager
Other              → anything that does not fit above

════════════════════════════════════════════════════════
FIELD 3 — tech_stack  (array of strings)
════════════════════════════════════════════════════════
All specific technologies mentioned: languages, frameworks, databases,
cloud platforms, data tools, DevOps tools.

Capitalisation rules (apply consistently):
  python      → Python          javascript → JavaScript    typescript → TypeScript
  golang      → Go              rust       → Rust          java       → Java
  kotlin      → Kotlin          scala      → Scala         ruby       → Ruby
  react       → React           vue        → Vue.js        angular    → Angular
  django      → Django          fastapi    → FastAPI       flask      → Flask
  postgresql  → PostgreSQL      mysql      → MySQL         mongodb    → MongoDB
  redis       → Redis           elasticsearch → Elasticsearch
  kafka       → Kafka           rabbitmq   → RabbitMQ      spark      → Apache Spark
  dbt         → dbt             airflow    → Apache Airflow
  aws         → AWS             gcp        → GCP           azure      → Azure
  kubernetes  → Kubernetes      docker     → Docker        terraform  → Terraform
  github actions → GitHub Actions  jenkins → Jenkins       gitlab ci → GitLab CI
  pytorch     → PyTorch         tensorflow → TensorFlow    sklearn    → scikit-learn

Scan ALL sections: requirements, nice-to-haves, tech environment, about us.
Return [] only if the posting mentions ZERO technologies.

════════════════════════════════════════════════════════
FIELD 4 — languages  (object: language → CEFR level)
════════════════════════════════════════════════════════
Keys are lowercase language names. Values are CEFR levels: A1 A2 B1 B2 C1 C2.

── ENGLISH ──────────────────────────────────────────
• Posting text is written in English
  → include "english": "C1"  (unless an explicit level is stated)
• Explicit level stated ("English C1", "fluent English", "business English")
  → use that level
• "English is a plus" / "beneficial"
  → "english": "B1"

── GERMAN ───────────────────────────────────────────
HARD REQUIREMENT — use "C1" if no level stated, or the stated level:
  Phrases: "Deutsch erforderlich", "German required", "German is a must",
  "Fließende Deutschkenntnisse", "Deutschkenntnisse erforderlich",
  "fluent German", "German: C1", "German B2", "Muttersprache Deutsch",
  posting is entirely written in German (even if silent on the requirement).

OPTIONAL / NICE-TO-HAVE — use "A2":
  Phrases: "Deutsch von Vorteil", "Deutschkenntnisse von Vorteil",
  "wünschenswert", "German is a plus", "nice to have", "beneficial",
  "German would be an advantage", "basic German", "some German", "Grundkenntnisse".

NOT MENTIONED AT ALL → omit "german" key entirely.

── OTHER LANGUAGES ───────────────────────────────────
Include only if explicitly required or listed as a plus.

════════════════════════════════════════════════════════
FIELD 5 — is_berlin_compatible  (boolean)
════════════════════════════════════════════════════════
true if ANY of:
  • Location is Berlin (or includes Berlin alongside other cities)
  • Remote role open to all of Germany:
    "bundesweit", "germany-wide", "deutschlandweit", "remote (germany)",
    "remote from germany", "work from anywhere in germany",
    "remote within germany", "remote in deutschland",
    "remote or berlin", "berlin oder remote"
false if:
  • Location is another city only (Munich, Hamburg, …) with no remote option
  • International remote without Germany specified

════════════════════════════════════════════════════════
FIELD 6 — remote_type  (string)
════════════════════════════════════════════════════════
"Full-Remote"  → 100% remote, no office required
"Hybrid"       → mix of remote and office days (or ambiguous)
"On-site"      → office only, no remote

Default to "Hybrid" when unclear.

════════════════════════════════════════════════════════
OUTPUT — return ONLY this JSON shape, nothing else:
{
  "title": "...",
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
_BERLIN_RE = re.compile(
    r"\b(berlin|bundesweit|germany.?wide|deutschlandweit|"
    r"remote.*germany|remote.*deutschland|work from.*germany|"
    r"anywhere in germany|remote in germany|remote \(germany\))\b",
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
    words = len(sample.split())
    if words < 20:
        return False
    en = len(_ENGLISH_WORDS_RE.findall(sample))
    de = len(_GERMAN_WORDS_RE.findall(sample))
    return en > de and (en / words) > 0.04


def _is_german_dominant(text: str) -> bool:
    sample = text[:2000]
    words = len(sample.split())
    if words < 20:
        return False
    de = len(_GERMAN_WORDS_RE.findall(sample))
    en = len(_ENGLISH_WORDS_RE.findall(sample))
    return de > en and (de / words) > 0.04


def _clean_title(title: str) -> str:
    """Strip company-name suffixes and gender markers from a raw title."""
    # "Title | Company" or "Title — Company" or "Title - Company (at Company)"
    for sep in [" | ", " — ", " – ", " at ", " @ "]:
        if sep in title:
            title = title.split(sep)[0].strip()
    # Remove trailing gender suffix
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
    Falls back to safe defaults if the markdown is too short to be a real job posting.
    """
    if not markdown or not markdown.strip():
        logger.warning("extract_job_data: empty markdown — returning defaults.")
        return _default_result()

    # If Crawl4AI returned almost nothing the page wasn't a real job posting
    if len(markdown.strip()) < 100:
        logger.warning(
            "extract_job_data: markdown too short (%d chars) — likely a cookie wall "
            "or redirect page. Returning defaults.", len(markdown.strip())
        )
        return _default_result()

    truncated = markdown[:14_000]  # generous — DeepSeek context is large
    client = _get_client()

    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0.0,
                max_tokens=600,
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
                logger.error("DeepSeek returned invalid JSON 3 times; returning defaults.")
                return _default_result()

        except Exception as exc:
            logger.error("Attempt %d: API error: %s", attempt, exc)
            if attempt == 3:
                logger.error("DeepSeek API failed 3 times; returning defaults.")
                return _default_result()

    return _default_result()


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------

def _validate_and_coerce(data: dict, original_markdown: str) -> dict:
    """Apply safety nets and normalise the model's raw output."""

    # ── title ────────────────────────────────────────────────────────────────
    raw_title = str(data.get("title", "") or "").strip()
    if not raw_title or raw_title.lower() == "unknown":
        data["title"] = "Unknown"
    else:
        data["title"] = _clean_title(raw_title)

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

    # Safety net: posting is English-dominant but model forgot english key
    if "english" not in langs and _is_english_dominant(original_markdown):
        langs["english"] = "C1"

    # Safety net: posting is German-dominant but model forgot german key
    if "german" not in langs and _is_german_dominant(original_markdown):
        langs["german"] = "C1"

    data["languages"] = langs

    # ── is_berlin_compatible ─────────────────────────────────────────────────
    model_flag = bool(data.get("is_berlin_compatible", False))
    regex_flag = bool(_BERLIN_RE.search(original_markdown))
    data["is_berlin_compatible"] = model_flag or regex_flag

    # ── remote_type ──────────────────────────────────────────────────────────
    if data.get("remote_type") not in ("Full-Remote", "Hybrid", "On-site"):
        data["remote_type"] = "Hybrid"

    return data


def _default_result() -> dict:
    return {
        "title":                "Unknown",
        "role_category":        "Other",
        "tech_stack":           [],
        "languages":            {},
        "is_berlin_compatible": False,
        "remote_type":          "Hybrid",
    }
