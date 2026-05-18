from typing import List, Optional

from pydantic import BaseModel


class PubMedArticle(BaseModel):
    pmid: str
    title: str
    abstract: str
    year: int
    journal: Optional[str] = None
    authors: List[str] = []
    doi: Optional[str] = None
    url: Optional[str] = None
    summary: Optional[str] = None


class PubMedSearchResponse(BaseModel):
    term: str
    entity_type: str
    total_results: int
    articles: List[PubMedArticle]
