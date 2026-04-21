import re
from urllib.parse import urlparse, urlunparse

_LEGAL_SUFFIX_PATTERN = re.compile(
    r"""
    [,\s]*
    \b
    (?:
        GmbH | Gesellschaft\ mbH |
        AG   | Aktiengesellschaft |
        SE   |
        KG   | Kommanditgesellschaft |
        UG   | OHG | GbR | e\.?V\.? |
        B\.?V\.? | S\.?A\.? | S\.?r\.?l\.? | ApS | Oy | AB | A/S | N\.?V\.? |
        S\.?A\.?S\.? | GIE | SARL |
        Ltd\.? | Limited | Inc\.? | Incorporated | Corp\.? | Corporation |
        LLC | PLC | LLP | LP | L\.P\.
    )
    \b
    \.?
    """,
    re.VERBOSE | re.IGNORECASE,
)

_WHITESPACE_PATTERN = re.compile(r"\s{2,}")


def normalize_name(raw_name: str) -> str:
    if not raw_name or not raw_name.strip():
        return ""
    name = raw_name.strip().strip('"')
    prev = None
    while prev != name:
        prev = name
        name = _LEGAL_SUFFIX_PATTERN.sub("", name)
    name = re.sub(r"[&,]\s*(Co\.?)?$", "", name, flags=re.IGNORECASE)
    name = _WHITESPACE_PATTERN.sub(" ", name).strip().lower()
    return name


def clean_url(raw_url: str) -> str:
    if not raw_url or not raw_url.strip():
        return ""
    url = raw_url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = "https://" + url
    parsed = urlparse(url)
    scheme = "https"
    netloc = re.sub(r"^www\.", "", parsed.netloc, flags=re.IGNORECASE).lower()
    path = parsed.path.rstrip("/").lower()
    return urlunparse((scheme, netloc, path, "", "", ""))


def normalize_company(raw_name: str, raw_url: str) -> dict:
    return {
        "normalized_name": normalize_name(raw_name),
        "homepage_url": clean_url(raw_url),
    }
