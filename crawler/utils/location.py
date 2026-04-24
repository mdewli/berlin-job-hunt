"""
location.py
===========
Berlin-compatibility checker.

Strategy
--------
A job is "Berlin-compatible" if a person living in Berlin could realistically
do it without relocating:

  1. The job location is Berlin itself (any district/neighbourhood).
  2. The job is in the Brandenburg commuter belt — cities reachable in ≤ 60 min
     by S-Bahn / RE train from Berlin Hbf.
  3. The job is fully remote AND available to workers in Germany.
  4. The job says "Germany" / "Deutschland" / "Bundesweit" without naming a
     specific non-Berlin city.

A job is NOT compatible if it names a specific German city outside the commuter
belt (Hamburg, Munich, Frankfurt, Cologne, Stuttgart, …) or if it is remote but
restricted to another country (Canada only, US only, …).
"""

import re

# ---------------------------------------------------------------------------
# Brandenburg commuter belt  (≤ 60 min to Berlin Hbf)
# ---------------------------------------------------------------------------
COMMUTER_CITIES: set[str] = {
    # Brandenburg core
    "potsdam", "teltow", "ludwigsfelde", "blankenfelde-mahlow", "blankenfelde",
    "mahlow", "zossen", "königs wusterhausen", "schönefeld", "großbeeren",
    "teltow-fläming",
    # North
    "oranienburg", "velten", "hennigsdorf", "birkenwerder", "hohen neuendorf",
    "glienicke", "wandlitz", "biesenthal",
    # East
    "strausberg", "fredersdorf-vogelsdorf", "fredersdorf", "neuenhagen",
    "hoppegarten", "erkner", "fürstenwalde", "eisenhüttenstadt",
    # West
    "falkensee", "nauen", "werder", "werder (havel)", "brandenburgische",
    "rathenow",
    # South-east
    "ahrensfelde", "bernau", "bernau bei berlin", "werneuchen",
}

# ---------------------------------------------------------------------------
# Explicit non-Berlin German cities (common ones from job boards)
# If a job names ONLY one of these and nothing else, it is not compatible.
# ---------------------------------------------------------------------------
_NON_BERLIN_CITIES: set[str] = {
    "hamburg", "münchen", "munich", "frankfurt", "cologne", "köln",
    "stuttgart", "düsseldorf", "dortmund", "essen", "bremen", "leipzig",
    "dresden", "hannover", "nuremberg", "nürnberg", "augsburg",
    "wiesbaden", "mainz", "heidelberg", "mannheim", "karlsruhe",
    "freiburg", "bonn", "münster", "bielefeld", "bochum", "aachen",
    "kiel", "lübeck", "rostock", "magdeburg", "erfurt", "jena",
    "chemnitz", "halle", "kassel",
}

# ---------------------------------------------------------------------------
# Non-German countries / regions (marks a job as NOT compatible)
# ---------------------------------------------------------------------------
_NON_GERMANY_COUNTRY_RE = re.compile(
    r"\b(canada|united states|usa|u\.s\.a|united kingdom|uk|u\.k\.|"
    r"australia|france|netherlands|spain|italy|poland|india|singapore|"
    r"new york|toronto|london|paris|amsterdam|madrid|sydney|bangalore)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Strong "Germany-remote" signals (anywhere in the text → compatible)
# ---------------------------------------------------------------------------
_GERMANY_REMOTE_RE = re.compile(
    r"\b(bundesweit|germany.?wide|deutschlandweit|"
    r"remote\s*(from|in|within|across)?\s*(germany|deutschland)|"
    r"work\s+from\s+(anywhere\s+in\s+)?(germany|deutschland)|"
    r"anywhere\s+in\s+germany|remote\s*\(?\s*germany\s*\)?|"
    r"remote\s*(or)?\s*berlin|berlin\s*(or)?\s*remote|"
    r"full.?remote.*germany|germany.*full.?remote)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Berlin location signals — only match in a *location* context, not company bio
# ---------------------------------------------------------------------------
_BERLIN_LOCATION_RE = re.compile(
    # Typical job-posting location fields
    r"(?:"
    r"location\s*:?\s*|"
    r"based\s+in\s+|"
    r"office\s+in\s+|"
    r"our\s+office\s*:?\s*|"
    r"job\s+location\s*:?\s*|"
    r"position\s+(?:is\s+)?(?:in|based)\s+|"
    r"role\s+(?:is\s+)?(?:in|based)\s+|"
    r"on.?site\s+(?:in|at)\s+|"
    r"hybrid\s+(?:in|at)\s+|"
    r"arbeitsort\s*:?\s*|"       # German: "Arbeitsort: Berlin"
    r"standort\s*:?\s*|"          # German: "Standort: Berlin"
    r"einsatzort\s*:?\s*"         # German: "Einsatzort: Berlin"
    r")\s*(?:\n|,\s*)?(?:\w+\s*,\s*)?berlin",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_berlin_compatible(
    location_raw: str,
    remote_type: str,
    markdown_text: str = "",
) -> bool:
    """
    Returns True if a Berlin resident can realistically do this job.

    Parameters
    ----------
    location_raw  : The location string extracted by the AI  (e.g. "Toronto, Canada")
    remote_type   : "Full-Remote" | "Hybrid" | "On-site"
    markdown_text : Full page markdown for regex fallback signals
    """
    loc = location_raw.lower().strip() if location_raw else ""

    # ── 1. Full-Remote globally / Germany-wide → always check country ────────
    if remote_type == "Full-Remote":
        # Remote-but-only-for-another-country → reject
        if _NON_GERMANY_COUNTRY_RE.search(loc):
            return False
        # Full-remote with no country restriction → accept
        return True

    # ── 2. Explicit Germany-remote signal in page text ────────────────────────
    if _GERMANY_REMOTE_RE.search(markdown_text):
        # But double-check the explicit location isn't somewhere abroad
        if _NON_GERMANY_COUNTRY_RE.search(loc):
            return False
        return True

    # ── 3. location_raw contains Berlin ──────────────────────────────────────
    if "berlin" in loc:
        return True

    # ── 4. location_raw is a Brandenburg commuter city ────────────────────────
    for city in COMMUTER_CITIES:
        if city in loc:
            return True

    # ── 5. location_raw says Germany / Deutschland (no specific non-Berlin city)
    if re.search(r"\b(germany|deutschland)\b", loc):
        # Reject if a specific non-Berlin city also appears
        for city in _NON_BERLIN_CITIES:
            if city in loc:
                return False
        return True

    # ── 6. No location mentioned at all — use page-level signals ─────────────
    if not loc or loc in ("not specified", "unspecified", ""):
        if _BERLIN_LOCATION_RE.search(markdown_text):
            return True
        if _GERMANY_REMOTE_RE.search(markdown_text):
            return True
        # No strong signal either way — return False (conservative)
        return False

    # ── 7. Named non-Berlin city ──────────────────────────────────────────────
    for city in _NON_BERLIN_CITIES:
        if city in loc:
            return False

    # ── 8. Unknown location (not Berlin, not a known non-Berlin city) ─────────
    # Be conservative: if we can't confirm it's Berlin-compatible, reject.
    return False


def check_markdown_signals(markdown: str) -> dict:
    """
    Utility for debugging — returns which regex signals fired for a given page.
    """
    return {
        "germany_remote":   bool(_GERMANY_REMOTE_RE.search(markdown)),
        "berlin_location":  bool(_BERLIN_LOCATION_RE.search(markdown)),
        "non_germany":      bool(_NON_GERMANY_COUNTRY_RE.search(markdown)),
    }
