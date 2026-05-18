from fastapi import APIRouter, HTTPException, Query
from typing import List

from backend.services.pubmed_service import PubMedService
from backend.models.pubmed_models import PubMedArticle, PubMedSearchResponse

router = APIRouter()
service = PubMedService()


@router.get("/search", response_model=PubMedSearchResponse)
async def search_pubmed(
    term: str = Query(..., min_length=3, description="Search term for PubMed."),
    entity_type: str = Query(
        "keyword",
        regex="^(disease|gene|drug|keyword)$",
        description="Search mode for a disease, gene, drug, or keyword.",
    ),
    max_results: int = Query(20, ge=1, le=50, description="Maximum number of PubMed results."),
):
    """Search PubMed and return annotated article summaries."""
    search_result = service.search(term, max_results=max_results)
    if not search_result["articles"]:
        raise HTTPException(status_code=404, detail="No PubMed articles found for this query.")

    articles = [PubMedArticle(**article) for article in search_result["articles"]]
    return PubMedSearchResponse(
        term=term,
        entity_type=entity_type,
        total_results=search_result["total_results"],
        articles=articles,
    )


@router.get("/article/{pmid}", response_model=PubMedArticle)
async def get_pubmed_article(pmid: str):
    """Fetch a single PubMed article by PMID."""
    article = service.fetch_article_by_pmid(pmid)
    if not article:
        raise HTTPException(status_code=404, detail="PubMed article not found")
    return PubMedArticle(**article)
