"""
discover.py
===========
Given a company dict (from the companies table), crawl its job_board_url
and return a list of individual job-posting URLs ready for the main pipeline.

Strategy
--------
1. Fetch the board page with Crawl4AI (JS wait included via utils/fetch.py).
2. Send the rendered Markdown to DeepSeek with a board-extraction prompt.
3. DeepSeek returns: [{title, url, location}] for every visible role.
4. Resolve any relative URLs to absolute ones.
5. Deduplicate and return.

Why use DeepSeek here instead of regex?
  Job boards are wildly inconsistent HTML. Some use numeric IDs in hrefs,
  some use slugs, some inline the title only as text next to a button.
  A language model reading the Markdown is far more robust than fragile
  CSS selectors or URL-pattern matching.
"""

import json
import logging
import os
import re
from typing import Any
from urllib.parse import urljoin, urlparse

from openai import OpenAI

from utils.fetch import fetch_markdown

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ATS-specific wait times (seconds).
# Heavy Workday / custom SPAs need longer delays.
# ---------------------------------------------------------------------------
_ATS_WAIT: dict[str, float] = {
    "workday":        5.0,
    "zalando":        5.0,
    "custom":         4.0,
    "greenhouse":     3.0,
    "lever":          3.0,
    "smartrecruiters": 3.0,
    "ashby":          3.0,
}
_DEFAULT_WAIT = 3.0

# ---------------------------------------------------------------------------
# DeepSeek prompt for job-board pages
# ---------------------------------------------------------------------------
_BOARD_SYSTEM_PROMPT = (
    "You are a job board scraper assistant.\n"
    "Given the Markdown of a company careers/jobs page, extract every individual "
    "job posting you can find.\n\n"
    "Return a JSON ARRAY (not an object). Each element must have exactly these keys:\n"
    "  title    — job title as written on the page\n"
    "  url      — the href/link for that role (may be relative, e.g. /jobs/123)\n"
    "  location — city or remote info shown next to the role; empty string if absent\n\n"
    "Rules:\n"
    "- Include ALL roles visible on the page, not just tech roles.\n"
    "- If the same title appears with different locations, include each separately.\n"
    "- If a link is not shown for a role, set url to empty string.\n"
    "- Return [] if the page shows no job listings (cookie wall, empty results, error).\n"
    "- Return ONLY the raw JSON array. No prose, no markdown fences."
)


def _get_client() -> OpenAI:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError("DEEPSEEK_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")


def _resolve_url(href: str, board_url: str) -> str:
    """Turn a relative href into an absolute URL using the board page as base."""
    if not href:
        return ""
    if href.startswith("http://") or href.startswith("https://"):
        return href
    return urljoin(board_url, href)


def _extract_jobs_from_markdown(markdown: str, board_url: str) -> list[dict]:
    """
    Ask DeepSeek to parse the board-page Markdown and return job entries.
    Returns a list of {title, url, location} dicts with absolute URLs.
    """
    if not markdown or not markdown.strip():
        logger.warning("Empty markdown — nothing to extract from board page.")
        return []

    client = _get_client()
    truncated = markdown[:14_000]   # generous limit; board pages can be long

    for attempt in range(1, 4):
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                temperature=0.0,
                max_tokens=2048,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _BOARD_SYSTEM_PROMPT},
                    {"role": "user",   "content": truncated},
                ],
            )
            raw = response.choices[0].message.content

            # DeepSeek sometimes wraps the array in {"jobs": [...]}
            parsed: Any = json.loads(raw)
            if isinstance(parsed, dict):
                # unwrap the first list-valued key
                for v in parsed.values():
                    if isinstance(v, list):
                        parsed = v
                        break
                else:
                    parsed = []

            if not isinstance(parsed, list):
                logger.warning("Unexpected response shape from DeepSeek: %r", type(parsed))
                return []

            results = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                url = _resolve_url(str(item.get("url", "")), board_url)
                if not url:
                    continue
                results.append({
                    "title":    str(item.get("title", "Unknown")).strip(),
                    "url":      url,
                    "location": str(item.get("location", "")).strip(),
                })

            logger.info("DeepSeek found %d job links on board page.", len(results))
            return results

        except json.JSONDecodeError as exc:
            logger.warning("Attempt %d: JSON parse error from board extractor: %s", attempt, exc)
            if attempt == 3:
                return []
        except Exception as exc:
            logger.error("Attempt %d: API error in board extractor: %s", attempt, exc)
            if attempt == 3:
                return []

    return []


async def discover_jobs(company: dict) -> list[dict]:
    """
    Top-level entry point.

    Parameters
    ----------
    company : dict
        A row from the companies table. Must have at least:
          - job_board_url  (str)
          - name           (str)
          - homepage_url   (str)
          - ats_type       (str | None)

    Returns
    -------
    list[dict]
        Each dict: {title, url, location, company_name, homepage_url}
        Only items with a non-empty url are returned.
    """
    board_url  = company.get("job_board_url", "")
    ats_type   = (company.get("ats_type") or "custom").lower()
    wait_secs  = _ATS_WAIT.get(ats_type, _DEFAULT_WAIT)

    if not board_url:
        logger.warning("Company %r has no job_board_url — skipping.", company.get("name"))
        return []

    logger.info("Discovering jobs for %s  ats=%s", company.get("name"), ats_type)

    try:
        markdown = await fetch_markdown(board_url, wait_seconds=wait_secs)
    except Exception as exc:
        logger.error("Failed to fetch board page for %s: %s", company.get("name"), exc)
        return []

    # Debug: show how much we got
    logger.info("Board page: %d chars of markdown", len(markdown))
    if len(markdown) < 100:
        logger.warning(
            "Very short board page (%d chars) — possible cookie wall or SPA not rendered.",
            len(markdown),
        )

    jobs = _extract_jobs_from_markdown(markdown, board_url)

    # Attach company metadata so the caller doesn't have to re-join
    for job in jobs:
        job["company_name"]  = company.get("name", "")
        job["homepage_url"]  = company.get("homepage_url", "")
        job["company_id"]    = str(company.get("id", ""))
        job["hq_city"]       = company.get("hq_city", "")
        job["company_size"]  = company.get("company_size", "")

    return jobs
