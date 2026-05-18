import re
from typing import Dict, List

from backend.utils.text import normalize_whitespace

COMMON_DISEASES = [
    "cancer",
    "diabetes",
    "alzheimers",
    "parkinson",
    "autism",
    "asthma",
    "covid-19",
    "coronavirus",
    "hypertension",
    "arthritis",
]

COMMON_DRUGS = [
    "aspirin",
    "metformin",
    "ibuprofen",
    "paracetamol",
    "statin",
    "imatinib",
    "trastuzumab",
    "penicillin",
    "tamoxifen",
    "dexamethasone",
]

COMMON_PROTEIN_SUFFIXES = [
    "kinase",
    "receptor",
    "protein",
    "enzyme",
    "factor",
    "cytokine",
    "transporter",
]

SUPPORT_TERMS = [
    "associated with",
    "linked to",
    "supports",
    "improves",
    "activates",
    "enhances",
    "stimulates",
    "promotes",
]

CONTRADICT_TERMS = [
    "not associated",
    "failed",
    "no evidence",
    "contradict",
    "disagrees",
    "does not support",
    "inhibits",
    "reduced",
    "no effect",
]

STOPWORDS = {
    "the",
    "and",
    "with",
    "from",
    "that",
    "for",
    "this",
    "were",
    "was",
    "are",
    "not",
    "but",
    "have",
    "has",
    "had",
}


class NLPService:
    def extract_entities(self, text: str) -> List[Dict[str, str]]:
        text = normalize_whitespace(text)
        lower = text.lower()
        entities: List[Dict[str, str]] = []

        for disease in COMMON_DISEASES:
            if disease in lower and not any(ent["name"] == disease for ent in entities):
                entities.append({"name": disease.title(), "type": "Disease"})

        for drug in COMMON_DRUGS:
            if drug in lower and not any(ent["name"] == drug for ent in entities):
                entities.append({"name": drug.title(), "type": "Drug"})

        for suffix in COMMON_PROTEIN_SUFFIXES:
            matches = re.findall(rf"\b[A-Za-z0-9\-]+{suffix}\b", text, flags=re.IGNORECASE)
            for match in matches:
                normalized = match.strip()
                if normalized and not any(ent["name"].lower() == normalized.lower() for ent in entities):
                    entities.append({"name": normalized, "type": "Protein"})

        gene_candidates = re.findall(r"\b[A-Z0-9]{2,6}\b", text)
        for candidate in gene_candidates:
            if candidate.lower() in STOPWORDS or candidate.isdigit() or len(candidate) < 2:
                continue
            if any(candidate.lower() == ent["name"].lower() for ent in entities):
                continue
            if any(suffix in candidate.lower() for suffix in ["ion", "ing", "the", "and"]):
                continue
            entities.append({"name": candidate, "type": "Gene"})

        return entities

    def classify_sentence(self, sentence: str) -> str:
        lower = sentence.lower()
        support = any(term in lower for term in SUPPORT_TERMS)
        contradict = any(term in lower for term in CONTRADICT_TERMS)
        if support and contradict:
            return "uncertain"
        if contradict:
            return "contradicts"
        if support:
            return "supports"
        return "uncertain"

    def keyword_strength(self, text: str) -> int:
        lower = text.lower()
        return sum(lower.count(term) for term in SUPPORT_TERMS)
