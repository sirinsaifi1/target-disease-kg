from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd

from backend.services.nlp_service import NLPService
from backend.services.pubmed_service import PubMedService
from backend.utils.text import extract_year, normalize_whitespace


class GraphService:
    def __init__(self) -> None:
        self.pubmed = PubMedService()
        self.nlp = NLPService()

    def build_literature_graph(
        self,
        term: str,
        entity_type: str = "disease",
        max_results: int = 20,
        min_year: Optional[int] = None,
        max_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        search_result = self.pubmed.search(term, max_results=max_results)
        articles = search_result["articles"]
        if not articles:
            return {
                "elements": {"nodes": [], "edges": []},
                "summary": {
                    "total_nodes": 0,
                    "total_edges": 0,
                    "unique_node_types": [],
                    "type_counts": {},
                    "year_min": None,
                    "year_max": None,
                    "total_papers": 0,
                },
                "insights": ["No articles were found for this search term."],
            }

        filtered_articles = self._filter_articles_by_year(articles, min_year, max_year)
        graph_payload = self._build_graph(term, filtered_articles, entity_type)
        return graph_payload

    def _filter_articles_by_year(
        self,
        articles: List[Dict[str, Any]],
        min_year: Optional[int],
        max_year: Optional[int],
    ) -> List[Dict[str, Any]]:
        if min_year is None and max_year is None:
            return articles

        results: List[Dict[str, Any]] = []
        for article in articles:
            year = article.get("year") or extract_year(article.get("pubdate", ""))
            if year and min_year is not None and year < min_year:
                continue
            if year and max_year is not None and year > max_year:
                continue
            results.append(article)
        return results

    def _build_graph(self, query: str, articles: List[Dict[str, Any]], entity_type: str) -> Dict[str, Any]:
        disease_node_id = f"Disease:{query.title()}"
        nodes: Dict[str, Dict[str, Any]] = {
            disease_node_id: {
                "data": {
                    "id": disease_node_id,
                    "label": query.title(),
                    "type": "Disease",
                    "details": {"query": query, "entity_type": entity_type},
                }
            }
        }
        edges: List[Dict[str, Any]] = []
        entity_stats: Dict[str, Dict[str, Any]] = {}
        timeline_counter: Dict[int, Counter] = defaultdict(Counter)
        paper_index: Dict[str, Dict[str, Any]] = {}

        for idx, article in enumerate(articles, start=1):
            pmid = str(article["pmid"])
            paper_id = f"Paper:{pmid}"
            abstract_snippet = normalize_whitespace(article.get("abstract", ""))[:240]
            paper_meta = {
                "pmid": pmid,
                "title": article.get("title", "")[:240] or f"PMID:{pmid}",
                "abstract_snippet": abstract_snippet,
                "year": article.get("year") or extract_year(article.get("pubdate", "")),
                "journal": article.get("journal"),
                "authors": article.get("authors", []),
                "doi": article.get("doi"),
                "url": article.get("url"),
            }
            paper_index[pmid] = paper_meta
            nodes[paper_id] = {
                "data": {
                    "id": paper_id,
                    "label": paper_meta["title"],
                    "type": "Paper",
                    "details": {
                        "pmid": pmid,
                        "title": paper_meta["title"],
                        "journal": paper_meta["journal"],
                        "year": paper_meta["year"],
                        "authors": paper_meta["authors"],
                        "doi": paper_meta["doi"],
                        "url": paper_meta["url"],
                        "abstract_snippet": paper_meta["abstract_snippet"],
                    },
                }
            }
            edges.append(
                {
                    "data": {
                        "id": f"e-paper-{idx}",
                        "source": disease_node_id,
                        "target": paper_id,
                        "relationship": "mentioned_in",
                        "label": "mentioned_in",
                        "confidence_score": 100,
                        "confidence": 100,
                        "support_count": 1,
                        "contradict_count": 0,
                        "uncertain_count": 0,
                        "evidence_links": [
                            {
                                **paper_meta,
                                "classification": "supports",
                            }
                        ],
                        "year": paper_meta["year"],
                    }
                }
            )

            article_text = normalize_whitespace(
                f"{article.get('title', '')}. {article.get('abstract', '')}"
            )
            entities = self.nlp.extract_entities(article_text)
            classification = self.nlp.classify_sentence(article_text)
            keyword_strength = self.nlp.keyword_strength(article_text)
            year = paper_meta["year"]

            if year:
                timeline_counter[year][classification] += 1

            for entity in entities:
                if entity_type != "keyword" and entity_type.lower() != entity["type"].lower() and entity_type != "disease":
                    continue
                entity_id = f"{entity['type']}:{entity['name']}"
                if entity_id not in nodes:
                    nodes[entity_id] = {
                        "data": {
                            "id": entity_id,
                            "label": entity["name"],
                            "type": entity["type"],
                            "details": {"source": "Auto-extracted"},
                        }
                    }
                relation_key = (disease_node_id, entity_id)
                bucket = entity_stats.setdefault(relation_key, {
                    "support_count": 0,
                    "contradict_count": 0,
                    "uncertain_count": 0,
                    "articles": set(),
                    "paper_ids": set(),
                    "supporting_papers": [],
                    "contradicting_papers": [],
                    "uncertain_papers": [],
                    "evidence_links": [],
                    "keywords": 0,
                    "year_counts": Counter(),
                })
                bucket["articles"].add(pmid)
                bucket["keywords"] += keyword_strength
                bucket["year_counts"][year or 0] += 1
                classification_key = {
                    "supports": "support_count",
                    "contradicts": "contradict_count",
                    "uncertain": "uncertain_count",
                }.get(classification, "uncertain_count")
                bucket[classification_key] += 1

                paper_link = {
                    "pmid": pmid,
                    "title": paper_meta["title"],
                    "year": paper_meta["year"],
                    "journal": paper_meta["journal"],
                    "url": paper_meta["url"],
                    "classification": classification,
                }
                if pmid not in bucket["paper_ids"]:
                    bucket["paper_ids"].add(pmid)
                    if classification == "supports":
                        bucket["supporting_papers"].append(paper_link)
                    elif classification == "contradicts":
                        bucket["contradicting_papers"].append(paper_link)
                    else:
                        bucket["uncertain_papers"].append(paper_link)
                    bucket["evidence_links"].append(paper_link)

                edges.append(
                    {
                        "data": {
                            "id": f"e-mention-{pmid}-{entity_id}",
                            "source": paper_id,
                            "target": entity_id,
                            "relationship": "mentions",
                            "label": "mentions",
                            "confidence_score": 75,
                            "confidence": 75,
                            "support_count": 1 if classification == "supports" else 0,
                            "contradict_count": 1 if classification == "contradicts" else 0,
                            "uncertain_count": 1 if classification == "uncertain" else 0,
                            "evidence_links": [paper_link],
                            "year": year,
                        }
                    }
                )

        relationship_edges: List[Dict[str, Any]] = []
        for (source, target), stats in entity_stats.items():
            support = stats.get("support_count", 0)
            contradict = stats.get("contradict_count", 0)
            uncertain = stats.get("uncertain_count", 0)
            article_count = len(stats["articles"])
            classification = "uncertain"
            if support > contradict and support > 0:
                classification = "supports"
            elif contradict > support and contradict > 0:
                classification = "contradicts"
            elif support == contradict and support > 0:
                classification = "uncertain"
            elif article_count > 0:
                classification = "associated_with"

            confidence = self._calculate_confidence(article_count, support, contradict, stats["keywords"])
            relationship_edges.append(
                {
                    "data": {
                        "id": f"e-rel-{source}-{target}",
                        "source": source,
                        "target": target,
                        "relationship": classification,
                        "label": classification,
                        "confidence_score": confidence,
                        "confidence": confidence,
                        "support_count": support,
                        "contradict_count": contradict,
                        "uncertain_count": uncertain,
                        "supporting_papers": stats["supporting_papers"],
                        "contradicting_papers": stats["contradicting_papers"],
                        "uncertain_papers": stats["uncertain_papers"],
                        "evidence_links": stats["evidence_links"],
                        "paper_count": article_count,
                        "year": max(stats["year_counts"].keys()) if stats["year_counts"] else None,
                    }
                }
            )

        elements = {"nodes": list(nodes.values()), "edges": edges + relationship_edges}
        summary = self._build_summary(elements, timeline_counter)
        insights = self._build_insights(entity_stats, query)
        top_findings = self._build_top_findings(relationship_edges)

        return {
            "elements": elements,
            "summary": summary,
            "insights": insights,
            "timeline": self._build_timeline(timeline_counter),
            "top_findings": top_findings,
            "papers": list(paper_index.values()),
        }

    def _calculate_confidence(
        self,
        article_count: int,
        support_count: int,
        contradict_count: int,
        keyword_strength: int,
    ) -> int:
        base = min(40 + article_count * 12, 80)
        support_bonus = min(20, support_count * 5)
        recency_bonus = min(15, max(0, 10 - (datetime.now().year - 2020)))
        keyword_bonus = min(15, keyword_strength * 2)
        score = base + support_bonus + recency_bonus + keyword_bonus
        return min(100, max(0, int(score)))

    def _build_summary(self, elements: Dict[str, List[Dict[str, Any]]], timeline_counter: Dict[int, Counter]) -> Dict[str, Any]:
        nodes = elements["nodes"]
        edges = elements["edges"]
        type_counts = Counter(node["data"]["type"] for node in nodes)
        years = sorted(year for year in timeline_counter.keys() if year and year > 0)

        return {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "unique_node_types": sorted(type_counts.keys()),
            "type_counts": dict(type_counts),
            "year_min": years[0] if years else None,
            "year_max": years[-1] if years else None,
            "total_papers": sum(1 for node in nodes if node["data"]["type"] == "Paper"),
        }

    def _build_timeline(self, timeline_counter: Dict[int, Counter]) -> List[Dict[str, Any]]:
        timeline = []
        for year in sorted(k for k in timeline_counter.keys() if k and k > 0):
            counter = timeline_counter[year]
            timeline.append(
                {
                    "year": year,
                    "supports": counter.get("supports", 0),
                    "contradicts": counter.get("contradicts", 0),
                    "uncertain": counter.get("uncertain", 0),
                }
            )
        return timeline

    def _build_insights(self, entity_stats: Dict[Any, Dict[str, Any]], query: str) -> List[str]:
        insights: List[str] = []
        if not entity_stats:
            return [f"No structured relationships detected for {query}." ]

        low_volume = []
        mixed_evidence = []
        for (source, target), stats in entity_stats.items():
            article_count = len(stats["articles"])
            support = stats.get("support_count", 0)
            contradict = stats.get("contradict_count", 0)
            if article_count <= 2 and support > 0:
                low_volume.append(target)
            if support > 0 and contradict > 0:
                mixed_evidence.append(target)

        if low_volume:
            insights.append(
                f"Emerging connections found to {len(low_volume)} entities with low publication volume: {', '.join(sorted(set(target.split(':', 1)[1] for target in low_volume)))}."
            )
        if mixed_evidence:
            insights.append(
                f"Mixed evidence detected for {len(mixed_evidence)} relationships, with both supporting and contradicting abstracts present."
            )
        if not insights:
            insights.append(
                f"The literature for {query} appears consistent, but additional research may reveal more nuanced relationships."
            )

        return insights

    def _build_top_findings(self, relationship_edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        sorted_edges = sorted(
            relationship_edges,
            key=lambda edge: (edge["data"].get("confidence_score", 0), edge["data"].get("support_count", 0), -edge["data"].get("contradict_count", 0)),
            reverse=True,
        )
        top_findings = []
        for edge in sorted_edges[:6]:
            data = edge["data"]
            top_findings.append(
                {
                    "id": data["id"],
                    "source": data["source"],
                    "target": data["target"],
                    "relationship": data["relationship"],
                    "confidence_score": data.get("confidence_score", 0),
                    "support_count": data.get("support_count", 0),
                    "contradict_count": data.get("contradict_count", 0),
                    "paper_count": data.get("paper_count", 0),
                    "evidence_links": data.get("evidence_links", []),
                }
            )
        return top_findings
