/**
 * Main app — wires upload UI, API, graph, stats, and sidebar.
 */

// In-memory state
let graphElements = null;
let graphSummary = null;
let selectedFile = null;

// DOM references
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const loadingEl = document.getElementById("loading");
const errorBanner = document.getElementById("error-banner");
const selectedFileEl = document.getElementById("selected-file");
const searchInput = document.getElementById("node-search");
const pubmedQueryInput = document.getElementById("pubmed-query");
const pubmedSearchBtn = document.getElementById("pubmed-search-btn");
const pubmedResultsEl = document.getElementById("pubmed-results");
const sidebarContent = document.getElementById("sidebar-content");

initSearchAutocomplete(searchInput);

// --- Error display ---
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

async function fetchPubmedResults(query) {
  if (!query?.trim?.()) {
    throw new Error("Enter a PMID or PubMed search term.");
  }

  const trimmed = query.trim();
  if (/^\d+$/.test(trimmed)) {
    const response = await axios.get(`${API_BASE_URL}/api/pubmed/${trimmed}`);
    return { direct: true, article: response.data };
  }

  const response = await axios.get(`${API_BASE_URL}/api/pubmed/disease_graph`, {
    params: { disease: trimmed, max_results: 12 },
    timeout: 60000,
  });
  return { direct: false, graph: response.data };
}

function renderPubmedArticle(article) {
  if (!pubmedResultsEl) return;

  const authors = Array.isArray(article.authors) ? article.authors.join(", ") : "Unknown";
  pubmedResultsEl.innerHTML = `
    <div class="article-card article-card--detail">
      <div class="article-card-header">
        <div>
          <p class="article-type">PubMed ID: ${escapeHtml(article.pubmed_id)}</p>
          <h4>${escapeHtml(article.title || "Untitled")}</h4>
        </div>
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer" class="article-link">View on PubMed</a>
      </div>
      <p class="article-meta">${escapeHtml(article.journal || "Unknown journal")} • ${escapeHtml(article.pub_date || "Unknown date")}</p>
      <p class="article-meta">Authors: ${escapeHtml(authors)}</p>
      ${article.abstract ? `<div class="article-abstract"><strong>Abstract</strong><p>${escapeHtml(article.abstract)}</p></div>` : ""}
    </div>
  `;
}

function renderPubmedSearchResults(results) {
  if (!pubmedResultsEl) return;
  if (!results || results.length === 0) {
    pubmedResultsEl.innerHTML = '<p class="muted">No PubMed articles found for this query.</p>';
    return;
  }

  pubmedResultsEl.innerHTML = results
    .map(
      (article) => `
      <div class="article-card">
        <div>
          <p class="article-type">PMID ${escapeHtml(article.pubmed_id)}</p>
          <h4>${escapeHtml(article.title || "Untitled")}</h4>
          <p class="article-meta">${escapeHtml(article.journal || "Unknown journal")} • ${escapeHtml(article.pub_date || "Unknown date")}</p>
        </div>
        <button type="button" class="article-select" data-pmid="${escapeHtml(article.pubmed_id)}">
          View details
        </button>
      </div>`
    )
    .join("");

  pubmedResultsEl.querySelectorAll(".article-select").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const pmid = event.currentTarget.dataset.pmid;
      if (!pmid) return;
      setPubmedLoading(true);
      hideError();
      try {
        const response = await axios.get(`${API_BASE_URL}/api/pubmed/${pmid}`);
        renderPubmedArticle(response.data);
      } catch (err) {
        const detail = err?.response?.data?.detail || err.message;
        showError(`PubMed lookup failed: ${detail}`);
      } finally {
        setPubmedLoading(false);
      }
    });
  });
}

function setPubmedLoading(isLoading) {
  if (!pubmedSearchBtn) return;
  pubmedSearchBtn.disabled = isLoading;
  pubmedQueryInput?.toggleAttribute("disabled", isLoading);
  pubmedResultsEl?.classList.toggle("loading", isLoading);
}

async function handlePubmedSearch() {
  if (!pubmedQueryInput) return;
  const query = pubmedQueryInput.value;
  if (!query.trim()) {
    showError("Enter a PubMed query or PMID.");
    return;
  }

  setPubmedLoading(true);
  hideError();

  try {
    const result = await fetchPubmedResults(query);
    if (result.direct) {
      renderPubmedArticle(result.article);
    } else {
      renderPubmedSearchResults(result.search.results);
    }
  } catch (err) {
    const detail = err?.response?.data?.detail || err.message;
    showError(`PubMed request failed: ${detail}`);
  } finally {
    setPubmedLoading(false);
  }
}

function renderPubmedSearchResults(results) {
  if (!pubmedResultsEl) return;
  if (!results || results.length === 0) {
    pubmedResultsEl.innerHTML = '<p class="muted">No PubMed articles found for this query.</p>';
    return;
  }

  pubmedResultsEl.innerHTML = results
    .map(
      (article) => `
      <div class="article-card">
        <div>
          <p class="article-type">PMID ${escapeHtml(article.pubmed_id)}</p>
          <h4>${escapeHtml(article.title || "Untitled")}</h4>
          <p class="article-meta">${escapeHtml(article.journal || "Unknown journal")} • ${escapeHtml(article.pub_date || "Unknown date")}</p>
        </div>
        <button type="button" class="article-select" data-pmid="${escapeHtml(article.pubmed_id)}">
          View details
        </button>
      </div>`
    )
    .join("");

  pubmedResultsEl.querySelectorAll(".article-select").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const pmid = event.currentTarget.dataset.pmid;
      if (!pmid) return;
      setPubmedLoading(true);
      hideError();
      try {
        const response = await axios.get(`${API_BASE_URL}/api/pubmed/${pmid}`);
        renderPubmedArticle(response.data);
      } catch (err) {
        const detail = err?.response?.data?.detail || err.message;
        showError(`PubMed lookup failed: ${detail}`);
      } finally {
        setPubmedLoading(false);
      }
    });
  });
}

async function handlePubmedSearch() {
  if (!pubmedQueryInput) return;
  const query = pubmedQueryInput.value;
  if (!query.trim()) {
    showError("Enter a PubMed query or PMID.");
    return;
  }

  setPubmedLoading(true);
  hideError();

  try {
    const result = await fetchPubmedResults(query);
    if (result.direct) {
      renderPubmedArticle(result.article);
      return;
    }

    const graph = result.graph;
    graphElements = graph.elements;
    graphSummary = graph.summary;
    renderStats(graphSummary);
    renderLegend(graphSummary.unique_node_types);
    renderGraph(graphElements, renderSidebar);
    setSearchSuggestions(graphElements);
    renderPubmedSearchResults(graph.articles);
  } catch (err) {
    const detail = err?.response?.data?.detail || err.message;
    showError(`PubMed request failed: ${detail}`);
  } finally {
    setPubmedLoading(false);
  }
}

// --- Loading state ---
function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  uploadBtn.disabled = isLoading;
  dropZone.style.pointerEvents = isLoading ? "none" : "auto";
  dropZone.style.opacity = isLoading ? "0.6" : "1";
}

// --- Stats panel ---
function renderStats(summary) {
  const empty = document.getElementById("stats-empty");
  const grid = document.getElementById("stats-grid");

  if (!summary) {
    empty.classList.remove("hidden");
    grid.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  grid.classList.remove("hidden");

  const items = [
    ["Total nodes", summary.total_nodes],
    ["Total edges", summary.total_edges],
    ["Diseases", summary.diseases_count],
    ["Genes", summary.genes_count],
    ["Compounds", summary.compounds_count],
    ["Pathways", summary.pathways_count],
    ["Proteins", summary.proteins_count],
  ];

  grid.innerHTML = items
    .map(
      ([label, value]) => `
    <div class="stat-card">
      <dt>${label}</dt>
      <dd>${value}</dd>
    </div>`
    )
    .join("");
}

// --- Sidebar for selected node or edge ---
function renderSidebar(nodeId, edgeId) {
  if (!nodeId && !edgeId) {
    sidebarContent.innerHTML =
      '<p class="muted">Select a node or edge to see its name, type, connections, and relationships.</p>';
    return;
  }

  if (edgeId && graphElements) {
    const edge = graphElements.edges.find((e) => e.data.id === edgeId);
    if (edge) {
      renderEdgeSidebar(edge);
      return;
    }
  }

  if (!nodeId || !graphElements) {
    sidebarContent.innerHTML =
      '<p class="muted">Select a node or edge to see its name, type, connections, and relationships.</p>';
    return;
  }

  const details = getNodeDetails(nodeId, graphElements);
  if (!details) return;

  const color = getNodeColor(details.type);
  const relHtml =
    details.relationships.length === 0
      ? '<p class="muted">No relationships</p>'
      : `<ul class="rel-list">${details.relationships
          .map((r) => `<li>${escapeHtml(r)}</li>`)
          .join("")}</ul>`;

  // Build node details block (for genes, papers, etc.)
  let nodeDetailsHtml = '';
  if (details.nodeData?.details) {
    const nodeInfo = details.nodeData.details;
    
    if (details.type === 'Paper' && nodeInfo.pmid) {
      // Display paper information
      nodeDetailsHtml = `
        <div class="detail-block">
          <p class="label">Paper Details</p>
          <div style="font-size:0.9rem;color:#cbd5e1">
            ${nodeInfo.pmid ? `<p><strong>PMID:</strong> ${escapeHtml(nodeInfo.pmid)}</p>` : ''}
            ${nodeInfo.journal ? `<p><strong>Journal:</strong> ${escapeHtml(nodeInfo.journal)}</p>` : ''}
            ${nodeInfo.year ? `<p><strong>Year:</strong> ${escapeHtml(String(nodeInfo.year))}</p>` : ''}
            ${nodeInfo.url ? `<p><a href="${escapeHtml(nodeInfo.url)}" target="_blank" rel="noreferrer" style="color:#60a5fa">View on PubMed →</a></p>` : ''}
          </div>
        </div>`;
    } else if (['Gene', 'Protein', 'Drug', 'Disease'].includes(details.type)) {
      // Display general entity details
      const detailsStr = Object.entries(nodeInfo)
        .filter(([key, val]) => val && key !== 'source')
        .map(([key, val]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(val))}</p>`)
        .join('');
      if (detailsStr) {
        nodeDetailsHtml = `
          <div class="detail-block">
            <p class="label">Details</p>
            <div style="font-size:0.9rem;color:#cbd5e1">
              ${detailsStr}
            </div>
          </div>`;
      }
    }
  }

  // Fetch related papers
  const relatedPapers = getRelatedPapers(nodeId, graphElements);
  const papersHtml = renderRelatedPapers(relatedPapers);

  sidebarContent.innerHTML = `
    <div class="detail-block">
      <p class="label">Name</p>
      <p class="value">${escapeHtml(details.name)}</p>
    </div>
    <div class="detail-block">
      <p class="label">Type</p>
      <span class="type-badge" style="background:${color}22;color:${color}">
        <span class="legend-dot" style="background:${color}"></span>
        ${escapeHtml(details.type)}
      </span>
    </div>
    <div class="detail-block">
      <p class="label">Connected nodes</p>
      <p class="value" style="color:#67e8f9;font-size:1.5rem">${details.connectedCount}</p>
    </div>
    <div class="detail-block">
      <p class="label">Relationships</p>
      ${relHtml}
    </div>
    ${nodeDetailsHtml}
    ${papersHtml}
  `;
}

function renderEdgeSidebar(edge) {
  const data = edge.data;
  const score = data.confidence_score ?? data.confidence ?? 0;
  const support = data.support_count ?? 0;
  const contradict = data.contradict_count ?? 0;
  const uncertain = data.uncertain_count ?? 0;

  const sourceNode = graphElements.nodes.find((n) => n.data.id === data.source);
  const targetNode = graphElements.nodes.find((n) => n.data.id === data.target);
  const sourceName = sourceNode ? sourceNode.data.label : data.source;
  const targetName = targetNode ? targetNode.data.label : data.target;

  const color =
    score >= 70 ? "#22c55e" : score >= 40 ? "#f97316" : "#ef4444";

  const evidenceHtml = [
    support > 0
      ? `<div class="evidence-item evidence-supporting">
        <strong>Supporting: ${support}</strong>
        <p class="muted">Evidence from PubMed</p>
      </div>`
      : "",
    contradict > 0
      ? `<div class="evidence-item evidence-contradicting">
        <strong>Contradicting: ${contradict}</strong>
        <p class="muted">Evidence from PubMed</p>
      </div>`
      : "",
    uncertain > 0
      ? `<div class="evidence-item evidence-uncertain">
        <strong>Uncertain: ${uncertain}</strong>
        <p class="muted">Mixed or unclear evidence</p>
      </div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  sidebarContent.innerHTML = `
    <div class="detail-block">
      <p class="label">Relationship</p>
      <p class="value">${escapeHtml(String(data.label || data.relationship || "Edge"))}</p>
    </div>
    <div class="detail-block">
      <p class="label">Entities</p>
      <p class="value" style="font-size:0.9rem">
        ${escapeHtml(sourceName)}<br>
        <span style="color:#94a3b8">→ ${escapeHtml(data.label || "connects to")} →</span><br>
        ${escapeHtml(targetName)}
      </p>
    </div>
    <div class="detail-block">
      <p class="label">Confidence Score</p>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="width:64px;height:8px;background:#1f2937;border-radius:4px;overflow:hidden">
          <div style="width:${score}%;height:100%;background:${color};transition:width 0.3s"></div>
        </div>
        <span style="font-weight:600;color:${color}">${score}%</span>
      </div>
    </div>
    <div class="detail-block">
      <p class="label">Evidence Summary</p>
      ${evidenceHtml ? `<div style="display:grid;gap:0.5rem">${evidenceHtml}</div>` : '<p class="muted">No evidence data</p>'}
    </div>
  `;
}

/** Get papers related to a node from edges with evidence_links */
function getRelatedPapers(nodeId, elements) {
  const papers = [];
  const seenPapers = new Set();

  elements.edges.forEach((edge) => {
    const { source, target, evidence_links, supporting_papers, contradicting_papers, uncertain_papers } = edge.data;
    
    // Check if this edge is connected to the node
    if (source === nodeId || target === nodeId) {
      // Add evidence links
      if (evidence_links && Array.isArray(evidence_links)) {
        evidence_links.forEach((link) => {
          if (link.pmid && !seenPapers.has(link.pmid)) {
            seenPapers.add(link.pmid);
            papers.push({
              ...link,
              classification: link.classification || 'associated',
            });
          }
        });
      }

      // Add supporting papers
      if (supporting_papers && Array.isArray(supporting_papers)) {
        supporting_papers.forEach((paper) => {
          if (paper.pmid && !seenPapers.has(paper.pmid)) {
            seenPapers.add(paper.pmid);
            papers.push({
              ...paper,
              classification: 'supports',
            });
          }
        });
      }

      // Add contradicting papers
      if (contradicting_papers && Array.isArray(contradicting_papers)) {
        contradicting_papers.forEach((paper) => {
          if (paper.pmid && !seenPapers.has(paper.pmid)) {
            seenPapers.add(paper.pmid);
            papers.push({
              ...paper,
              classification: 'contradicts',
            });
          }
        });
      }

      // Add uncertain papers
      if (uncertain_papers && Array.isArray(uncertain_papers)) {
        uncertain_papers.forEach((paper) => {
          if (paper.pmid && !seenPapers.has(paper.pmid)) {
            seenPapers.add(paper.pmid);
            papers.push({
              ...paper,
              classification: 'uncertain',
            });
          }
        });
      }
    }
  });

  return papers;
}

/** Render related papers for sidebar display */
function renderRelatedPapers(papers) {
  if (!papers || papers.length === 0) {
    return '';
  }

  const getClassificationBadge = (classification) => {
    const colors = {
      'supports': { bg: '#22c55e', label: 'Supporting' },
      'contradicts': { bg: '#ef4444', label: 'Contradicting' },
      'uncertain': { bg: '#9ca3af', label: 'Uncertain' },
      'associated': { bg: '#60a5fa', label: 'Associated' },
    };
    const color = colors[classification] || colors['associated'];
    return `<span style="background:${color.bg}22;color:${color.bg};padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600">${color.label}</span>`;
  };

  const papersHtml = papers.slice(0, 5).map((paper) => `
    <div style="border-left:3px solid #60a5fa;padding-left:0.75rem;margin-bottom:0.75rem">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem;margin-bottom:0.25rem">
        <p style="font-size:0.85rem;font-weight:600;color:#e2e8f0;flex:1">${escapeHtml(paper.title || 'Untitled')}</p>
        ${getClassificationBadge(paper.classification)}
      </div>
      <p style="font-size:0.75rem;color:#94a3b8;margin:0.25rem 0">
        ${paper.journal ? `${escapeHtml(paper.journal)}` : 'Unknown Journal'} • ${paper.year || 'Unknown Year'}
      </p>
      ${paper.pmid ? `<p style="font-size:0.75rem;color:#94a3b8;margin:0.25rem 0">PMID: ${escapeHtml(paper.pmid)}</p>` : ''}
      ${paper.url ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer" style="color:#60a5fa;font-size:0.75rem;text-decoration:none;display:inline-block;margin-top:0.25rem">View on PubMed →</a>` : ''}
    </div>
  `).join('');

  const remainingCount = papers.length - 5;
  return `
    <div class="detail-block">
      <p class="label">Related Papers (${papers.length})</p>
      <div style="font-size:0.9rem;color:#cbd5e1">
        ${papersHtml}
        ${remainingCount > 0 ? `<p class="muted" style="font-size:0.75rem;margin-top:0.5rem">+${remainingCount} more papers</p>` : ''}
      </div>
    </div>
  `;
}

/** Prevent XSS when inserting user CSV labels into HTML */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --- File handling ---
function onFileChosen(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showError("Please upload a .csv file");
    return;
  }
  selectedFile = file;
  selectedFileEl.textContent = "Selected: " + file.name;
  selectedFileEl.classList.remove("hidden");
  hideError();
  // Auto-upload when file is chosen
  doUpload(file);
}

async function doUpload(file) {
  setLoading(true);
  hideError();
  searchInput.value = "";
  searchInput.disabled = true;
  setSearchSuggestions(null);

  try {
    const data = await uploadCsv(file);
    graphElements = data.elements;
    graphSummary = data.summary;

    renderStats(graphSummary);
    renderLegend(graphSummary.unique_node_types);
    renderGraph(graphElements, renderSidebar);
    setSearchSuggestions(graphElements);

    searchInput.disabled = false;
    searchInput.placeholder = "Search nodes by name…";
  } catch (err) {
    console.log(err);
    let message = "Upload failed. Is the backend running on port 8000?";
    if (err.response && err.response.data && err.response.data.detail) {
      const d = err.response.data.detail;
      message = typeof d === "string" ? d : JSON.stringify(d);
    }
    showError(message);
    graphElements = null;
    graphSummary = null;
    setSearchSuggestions(null);
    renderStats(null);
  } finally {
    setLoading(false);
  }
}

pubmedSearchBtn?.addEventListener("click", handlePubmedSearch);
pubmedQueryInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handlePubmedSearch();
  }
});

// --- Event listeners ---

// Click drop zone or upload button opens file picker
dropZone.addEventListener("click", () => fileInput.click());
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  onFileChosen(e.target.files[0]);
});

// Drag and drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  onFileChosen(file);
});

// Keyboard: Enter on drop zone opens picker
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// Initial legend (default types)
renderLegend([]);

