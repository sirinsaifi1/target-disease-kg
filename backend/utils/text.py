import re


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def extract_year(date_text: str) -> int:
    match = re.search(r"(19|20)\d{2}", str(date_text or ""))
    return int(match.group(0)) if match else 0
