"""
fetch.py
========
Shared async helper that fetches a URL with Crawl4AI and returns clean Markdown.

The key fix over a naive arun() call:
  delay_before_return_html — pauses after page load so JavaScript SPAs
  (Zalando, Workday, Greenhouse etc.) have time to render their content
  before Crawl4AI reads the DOM.

Used by both main.py (single-posting pipeline) and discover.py (board crawler).
"""

import logging

logger = logging.getLogger(__name__)


async def fetch_markdown(url: str, wait_seconds: float = 3.0) -> str:
    """
    Fetch a URL with Crawl4AI and return the rendered Markdown.

    Parameters
    ----------
    url : str
        The page to fetch.
    wait_seconds : float
        Seconds to pause after initial page load before reading the DOM.
        Increase for heavy SPAs (Workday: 5.0, Zalando: 4.0).
        Default 3.0 works for most Greenhouse / Lever boards.

    Returns
    -------
    str
        Rendered Markdown. Empty string if Crawl4AI returns nothing.

    Raises
    ------
    ImportError   if crawl4ai is not installed.
    RuntimeError  if Crawl4AI reports a fetch failure.
    """
    try:
        from crawl4ai import AsyncWebCrawler, CacheMode
    except ImportError as exc:
        raise ImportError(
            "crawl4ai is not installed. Run: pip install crawl4ai"
        ) from exc

    logger.info("Crawling: %s  (wait=%.1fs)", url, wait_seconds)

    async with AsyncWebCrawler(headless=True, verbose=False) as crawler:
        result = await crawler.arun(
            url=url,
            cache_mode=CacheMode.BYPASS,
            word_count_threshold=10,         # lower than default; board pages vary
            remove_overlay_elements=True,    # dismiss cookie banners
            delay_before_return_html=wait_seconds,
        )

    if not result.success:
        raise RuntimeError(f"Crawl4AI failed for {url}: {result.error_message}")

    markdown = result.markdown or ""
    logger.info("Fetched %d chars from %s", len(markdown), url)
    return markdown
