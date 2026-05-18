from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    details: Optional[Dict[str, Any]] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    confidence: Optional[int] = None
    support_count: Optional[int] = None
    contradict_count: Optional[int] = None
    year: Optional[int] = None


class GraphSummary(BaseModel):
    total_nodes: int
    total_edges: int
    unique_node_types: List[str]
    type_counts: Dict[str, int]
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    total_papers: Optional[int] = None


class GraphResponse(BaseModel):
    elements: Dict[str, List[Dict[str, Any]]]
    summary: GraphSummary
    insights: List[str]
