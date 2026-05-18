from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from backend.api.graph import router as graph_router
from backend.api.pubmed import router as pubmed_router

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = FastAPI(
    title="Biomedical Literature Intelligence Graph Explorer",
    description="A lightweight PubMed-powered knowledge graph explorer for disease, gene, drug, and keyword literature intelligence.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pubmed_router, prefix="/api/pubmed", tags=["PubMed"])
app.include_router(graph_router, prefix="/api/graph", tags=["Graph"])

app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR / "static")),
    name="static",
)

templates = Jinja2Templates(directory=str(FRONTEND_DIR / "templates"))


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running"}


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
