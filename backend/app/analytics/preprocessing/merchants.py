import re
import unicodedata

try:
    from rapidfuzz import fuzz, process
except ModuleNotFoundError:  # Offline development; uv installs the accelerated dependency.
    fuzz = process = None

from app.analytics.config import CONFIG
from app.analytics.preprocessing.timestamps import POS_PREFIX


def normalize_merchant(description: str) -> str:
    value = "".join(
        c for c in unicodedata.normalize("NFKD", description.upper()) if not unicodedata.combining(c)
    )
    value = POS_PREFIX.sub("", value)
    value = re.sub(r"\bTRANSFER\s+(?:INTRARE|IESIRE)\b", "", value)
    value = re.sub(r"\b(?:SRL|SA|BUCURESTI|BUC|ROMANIA)\b", "", value)
    value = re.sub(r"\*(?:BUC)?\d+|\b(?:POS|TERM(?:INAL)?|REF)\s*\d+|\b\d{3,}\b", "", value)
    value = re.sub(r"[^A-Z0-9 ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    # Compact aliases occur in terminal labels; preserve significant digits in 18GYM.
    value = re.sub(r"\bMEGAIMAGE\b", "MEGA IMAGE", value)
    value = re.sub(r"\bCAFENEAX\b", "CAFENEA X", value)
    value = re.sub(r"\b18GYM(?: FITNESS)?\b", "18GYM", value)
    value = re.sub(r"\bLIDL(?: ROMANIA)?\b", "LIDL", value)
    return value or "UNKNOWN"


def resolve_merchant(
    description: str, names: list[str], aliases: dict[str, str], threshold: int = CONFIG.fuzzy_score
) -> str:
    name = normalize_merchant(description)
    if name in aliases:
        return aliases[name]
    if name in names:
        return name
    if process is not None:
        match = process.extractOne(name, names, scorer=fuzz.ratio, score_cutoff=threshold)
        return match[0] if match else name
    # Exact normalized Indel similarity, the same metric as fuzz.ratio. Slow path
    # for small offline fixtures; no alternative threshold or approximate scorer.
    best, best_score = name, threshold - 1
    for candidate in names:
        previous = [0] * (len(candidate) + 1)
        for char in name:
            current = [0]
            for index, other in enumerate(candidate, start=1):
                current.append(
                    previous[index - 1] + 1 if char == other else max(previous[index], current[-1])
                )
            previous = current
        similarity = 200 * previous[-1] / (len(name) + len(candidate))
        if similarity >= threshold and similarity > best_score:
            best, best_score = candidate, similarity
    return best
