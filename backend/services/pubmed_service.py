import re
import time
from typing import Any, Dict, Iterable, List

import requests
from backend.utils.cache import ttl_cache
from backend.utils.text import normalize_whitespace


class PubMedService:
    SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Biomedical Literature Intelligence/1.0",
            }
        )

    def _get(self, url: str, params: Dict[str, Any]) -> requests.Response:
        response = self.session.get(url, params=params, timeout=20)
        response.raise_for_status()
        return response

    def search(self, term: str, max_results: int = 20) -> Dict[str, Any]:
        query = normalize_whitespace(term)
        params = {
            "db": "pubmed",
            "term": query,
            "retmode": "json",
            "retmax": max_results,
            "sort": "relevance",
        }
        response = self._get(self.SEARCH_URL, params)
        payload = response.json()
        result = payload.get("esearchresult", {})
        pmids = result.get("idlist", [])
        return {
            "term": term,
            "total_results": int(result.get("count", len(pmids) or 0)),
            "article_ids": pmids,
            "articles": self.fetch_articles(pmids),
        }

    @ttl_cache(seconds=3600)
    def fetch_summaries(self, pmids: Iterable[str]) -> List[Dict[str, Any]]:
        pmid_list = [str(p).strip() for p in pmids if str(p).strip()]
        if not pmid_list:
            return []

        params = {
            "db": "pubmed",
            "id": ",".join(pmid_list),
            "retmode": "json",
        }
        response = self._get(self.SUMMARY_URL, params)
        payload = response.json()
        result = payload.get("result", {})

        summaries: List[Dict[str, Any]] = []
        for pmid in pmid_list:
            article = result.get(str(pmid))
            if not article:
                continue
            summaries.append(self._normalize_summary(article))

        return summaries

    @ttl_cache(seconds=3600)
    def fetch_article_by_pmid(self, pmid: str) -> Dict[str, Any]:
        pmid = str(pmid).strip()
        articles = self.fetch_summaries([pmid])
        if not articles:
            return {}

        summary = articles[0]
        summary["abstract"] = self.fetch_abstract(pmid)
        return summary

    @ttl_cache(seconds=3600)
    def fetch_abstract(self, pmid: str) -> str:
        pmid = str(pmid).strip()
        if not pmid:
            return ""

        params = {
            "db": "pubmed",
            "id": pmid,
            "rettype": "abstract",
            "retmode": "text",
        }
        response = self._get(self.FETCH_URL, params)
        return response.text.strip()

    def fetch_articles(self, pmids: Iterable[str]) -> List[Dict[str, Any]]:
        summaries = self.fetch_summaries(pmids)
        enriched: List[Dict[str, Any]] = []
        for summary in summaries:
            pmid = summary.get("pmid")
            if not pmid:
                continue
            enriched.append(
                {
                    **summary,
                    "abstract": self.fetch_abstract(pmid),
                    "source_text": normalize_whitespace(
                        f"{summary.get('title', '')} {summary.get('abstract', '')}"
                    ),
                }
            )
        return enriched

    def _normalize_summary(self, article: Dict[str, Any]) -> Dict[str, Any]:
        pubdate = article.get("pubdate", "")
        year = self._extract_year(pubdate)
        authors = []
        for author in article.get("authors", []):
            if isinstance(author, dict):
                name = author.get("name")
                if name:
                    authors.append(name)
            elif isinstance(author, str):
                authors.append(author)

        doi = article.get("elocationid") or article.get("doi")
        url = f"https://pubmed.ncbi.nlm.nih.gov/{article.get('uid')}/"

        return {
            "pmid": str(article.get("uid", "")),
            "title": article.get("title", ""),
            "journal": article.get("source", ""),
            "pubdate": pubdate,
            "year": year,
            "authors": authors,
            "doi": doi,
            "url": url,
            "summary": article.get("summary", ""),
        }

    @staticmethod
    def _extract_year(pubdate: str) -> int:
        match = re.search(r"(19|20)\d{2}", str(pubdate))
        return int(match.group(0)) if match else 0
