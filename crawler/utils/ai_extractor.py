"""
ai_extractor.py
===============
Uses the DeepSeek API (OpenAI-compatible) to extract structured job data
from a scraped Markdown string.

Returned schema
---------------
{
    "title":                str,          # Job title
    "role_category":        str,          # "Backend", "Data Science", "Frontend", etc.
    "tech_stack":           list[str],    # ["Python", "PostgreSQL", "dbt"]
    "languages":            dict,         # {"german": "B2", "english": "C1"}
    "is_berlin_compatible": bool,         # True if Berlin OR Germany-wide remote
    "remote_type":          str,          # "Full-Remote" | "Hybrid" | "On-site"
}

Language defaults
-----------------
- Posting written in English -> english: C1  (safety net applied in post-processing)
- German hard requirement, no level stated -> german: C1
- German "a plus" / "nice to have"        -> german: A2
- German not mentioned                    -> omit german key entirely
"""

import json
import logging
import os
import re
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Role-category taxonomy
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
# System prompt
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = (
    "You are a job-posting data extractor for a Berlin tech job board.\n"
    "Given the Markdown text of a job posting, extract structured data and return a\n"
    "single JSON object. No prose, no markdown fences -- raw JSON only.\n"
    "\n"
    "Fields to extract:\n"
    "\n"
    "1. title\n"
    "   The job title exactly as written. Infer from context if not explicit.\n"
    "   Use \"Unknown\" only as a last resort.\n"
    "\n"
    "2. role_category\n"
    "   Pick exactly ONE from this list:\n"
    "   {categories}\n"
    "\n"
    "3. tech_stack\n"
    "   Array of specific technologies: programming languages, frameworks, libraries,\n"
    "   databases, cloud platforms, DevOps tools, data tools.\n"
    "   Normalise capitalisation: python->Python, postgresql->PostgreSQL,\n"
    "   kubernetes->Kubernetes, aws->AWS, gcp->GCP.\n"
    "   Be thorough -- scan requirements, nice-to-haves, and tech environment sections.\n"
    "   Return [] only if the posting mentions zero technologies.\n"
    "\n"
    "4. languages\n"
    "   Object mapping lowercase language name to CEFR level ({cefr}).\n"
    "\n"
    "   ENGLISH rules:\n"
    "   - If the job posting TEXT is written in English, include \"english\": \"C1\".\n"
    "   - If an explicit English CEFR level is stated, use that instead.\n"
    "\n"
    "   GERMAN rules:\n"
    "   - Hard requirement, no level stated  -> \"german\": \"C1\"\n"
    "   - Hard requirement with stated level -> use that level\n"
    "   - Described as a plus / nice to have / von Vorteil / wuenschenswert\n"
    "     / optional / beneficial            -> \"german\": \"A2\"\n"
    "   - Posting written in German, no German requirement -> \"german\": \"C1\"\n"
    "   - German not mentioned at all        -> omit the key entirely\n"
    "\n"
    "   Other languages: include only if explicitly required or mentioned as a plus.\n"
    "\n"
    "5. is_berlin_compatible\n"
    "   true if ANY apply:\n"
    "   - Location includes Berlin\n"
    "   - Remote and open to all of Germany (bundesweit, germany-wide,\n"
    "     deutschlandweit, remote from Germany, work from anywhere in Germany)\n"
    "   false otherwise.\n"
    "\n"
    "6. remote_type\n"
    "   One of: \"Full-Remote\", \"Hybrid\", \"On-site\"\n"
    "   Default to \"Hybrid\" if ambiguous.\n"
    "\n"
    "Return ONLY the JSON object with these six keys.\n"
).format(
    categories="\n   ".join(f"- {c}" for c in ROLE_CATEGORIES),
    cefr=", ".join(CEFR_LEVELS),
)

# ---------------------------------------------------------------------------
# Regexes used in post-processing
# ---------------------------------------------------------------------------
_BERLIN_KEYWORDS = re.compile(
    r"\b(berlin|bundesweit|germany.?wide|deutschlandweit|remote.*germany|"
    r"work from.*germany|anywhere in germany)\b",
    re.IGNORECASE,
)

# Common English function words — used to detect English-dominant text
_ENGLISH_WORDS_RE = re.compile(
    r"\b(the|and|you|will|our|team|we|are|have|with|your|for|this|that)\b",
    re.IGNORECASE,
)


def _is_english_dominant(text: str) -> bool:
    """Return True when the first 2 000 chars look like English prose."""
    sample = text[:2000]
    words   = len(sample.split())
    matches = len(_ENGLISH_WORDS_RE.findall(sample))
    return words > 20 and (matches / words) > 0.05


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

def _get_client() -> OpenAI:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError("DEEPSEEK_API_KEY environment variable is not set.")
    return OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com/v1",
    )


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_job_data(markdown: str, model: str = "deepseek-chat") -> dict[str, Any]:
    """
    Send markdown to DeepSeek and return a structured job-data dict.

    Parameters
    ----------
    markdown : str
        Raw Markdown produced by Crawl4AI for a single job posting page.
    model : str
        DeepSeek model name. Default: "deepseek-chat".

    Returns
    -------
    dict with keys: title, role_category, tech_stack, languages,
                    is_berlin_compatible, remote_type.
    """
    if not markdown or not markdown.strip():
        logger.warning("extract_job_data called with empty markdown; returning defaults.")
        return _default_result()

    # Truncate to ~12 000 chars to stay within context limits cheaply
    truncated = markdown[:12_000]

    client = _get_client()

    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0.0,
                max_tokens=512,
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
                raise ValueError(
                    f"DeepSeek returned invalid JSON after 3 attempts: {exc}"
                ) from exc

        except Exception as exc:
            logger.error("Attempt %d: API error: %s", attempt, exc)
            if attempt == 3:
                raise RuntimeError(
                    f"DeepSeek API failed after 3 attempts: {exc}"
                ) from exc


# ---------------------------------------------------------------------------
# Post-processing / validation
# ---------------------------------------------------------------------------

def _validate_and_coerce(data: dict, original_markdown: str) -> dict:
    """Apply defaults and safety-net rules to the model raw output."""

    # title
    data.setdefault("title", "Unknown")

    # role_category
    if data.get("role_category") not in ROLE_CATEGORIES:
        data["role_category"] = "Other"

    # tech_stack
    stack = data.get("tech_stack", [])
    if not isinstance(stack, list):
        stack = []
    data["tech_stack"] = [str(t).strip() for t in stack if t]

    # languages: validate CEFR values and normalise keys to lowercase
    langs = data.get("languages", {})
    if not isinstance(langs, dict):
        langs = {}
    langs = {
        k.lower(): v.upper()
        for k, v in langs.items()
        if isinstance(v, str) and v.upper() in CEFR_LEVELS
    }

    # Safety net: posting is in English but model omitted the english key
    if "english" not in langs and _is_english_dominant(original_markdown):
        langs["english"] = "C1"

    data["languages"] = langs

    # is_berlin_compatible: model flag OR regex match as safety net
    model_flag = bool(data.get("is_berlin_compatible", False))
    regex_flag = bool(_BERLIN_KEYWORDS.search(original_markdown))
    data["is_berlin_compatible"] = model_flag or regex_flag

    # remote_type
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
