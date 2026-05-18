# Biomedical Literature Intelligence Graph Explorer

A lightweight full-stack research intelligence application powered by PubMed. This platform builds knowledge graphs from biomedical literature search terms, detects evidence strength, contradictory findings, temporal trends, and research gaps.

## Features

- PubMed search by disease, gene, drug, or keyword
- Article retrieval with title, abstract, authors, journal, and year
- Entity extraction for disease, gene, protein, drug/compound mentions
- Knowledge graph generation with Cytoscape.js visualization
- Evidence scoring and contradictory evidence detection
- Time-based relationship evolution
- Research gap insight generation
- Interactive graph exploration with node detail panels

## Project structure

```
project/
├── backend/
│   ├── api/
│   ├── models/
│   ├── services/
│   ├── utils/
│   └── main.py
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   └── js/
│   └── templates/
├── requirements.txt
├── README.md
└── .gitignore
```

## Installation

```bash
cd /workspaces/target-disease-kg
python -m pip install -r requirements.txt
```

## Run

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000` in your browser.

## Sample searches

- `Alzheimer disease`
- `BRCA1`
- `aspirin`
- `immune checkpoint inhibitor`

## Notes

- Backend caches PubMed summaries and abstracts for up to one hour.
- The entity extraction is intentionally lightweight for this prototype and uses pattern matching rather than heavy NLP.
- The graph endpoint returns node metadata, edge confidence scores, and timeline insights.
