from fastapi import APIRouter, HTTPException, Query

from backend.services.graph_service import GraphService

router = APIRouter()
service = GraphService()


@router.get("/literature")
async def literature_graph(
    term: str = Query(..., min_length=3, description="Disease, gene, drug or keyword search term."),
    entity_type: str = Query(
        "disease",
        regex="^(disease|gene|drug|keyword)$",
        description="Filter extracted entities by type.",
    ),
    max_results: int = Query(20, ge=5, le=50, description="Maximum PubMed articles to include."),
    min_year: int | None = Query(None, description="Minimum publication year to include."),
    max_year: int | None = Query(None, description="Maximum publication year to include."),
):
    """Build a literature intelligence graph for the given search term."""
    try:
        graph = service.build_literature_graph(
            term=term,
            entity_type=entity_type,
            max_results=max_results,
            min_year=min_year,
            max_year=max_year,
        )
        return graph
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
