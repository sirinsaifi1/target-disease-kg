const searchInput = document.getElementById("search-term");
const entityTypeInput = document.getElementById("entity-type");
const minYearInput = document.getElementById("min-year");
const maxYearInput = document.getElementById("max-year");
const searchButton = document.getElementById("search-button");
const statusBanner = document.getElementById("status-banner");
const statsNodes = document.getElementById("stat-nodes");
const statsEdges = document.getElementById("stat-edges");
const statsPapers = document.getElementById("stat-papers");
const statsYears = document.getElementById("stat-years");
const insightList = document.getElementById("insight-list");
const nodeDetail = document.getElementById("node-detail");
const timelineChart = document.getElementById("timeline-chart");
const fitButton = document.getElementById("btn-fit");
const zoomInButton = document.getElementById("btn-zoom-in");
const zoomOutButton = document.getElementById("btn-zoom-out");
const layoutSelect = document.getElementById("layout-select");
const showMoreButton = document.getElementById("show-more-btn");

let currentGraph = null;
let activeYear = null;
let showMoreEnabled = false;
let currentLayout = "fcose";

function showStatus(message, isError = false) {
  statusBanner.textContent = message;
  statusBanner.classList.toggle("hidden", !message);
  statusBanner.style.borderColor = isError ? "#dc2626" : "#334155";
  statusBanner.style.color = isError ? "#fecaca" : "#cbd5e1";
  statusBanner.style.background = isError ? "rgba(220, 38, 38, 0.12)" : "rgba(30, 41, 59, 0.85)";
}

function clearStatus() {
  showStatus("");
}

function setLoading(isLoading) {
  searchButton.disabled = isLoading;
  searchButton.textContent = isLoading ? "Loading…" : "Build literature graph";
}

function updateSummary(summary) {
  statsNodes.textContent = summary.total_nodes;
  statsEdges.textContent = summary.total_edges;
  statsPapers.textContent = summary.total_papers ?? 0;
  if (summary.year_min && summary.year_max) {
    statsYears.textContent = `${summary.year_min}–${summary.year_max}`;
  } else {
    statsYears.textContent = "—";
  }
}

function renderInsights(insights) {
  insightList.innerHTML = insights
    .map((insight) => `<li>${escapeHtml(insight)}</li>`)
    .join("");
}

function renderDetails(nodeId) {
  if (!nodeId) {
    nodeDetail.innerHTML = `<p class="muted">Select a node to see detailed metadata and relationship evidence.</p>`;
    return;
  }

  const details = getNodeDetails(nodeId);
  if (!details) {
    nodeDetail.innerHTML = `<p class="muted">No details available for the selected node.</p>`;
    return;
  }

  const lines = [];
  lines.push(`<div class="detail-block"><p class="label">Name</p><p class="value">${escapeHtml(details.label)}</p></div>`);
  lines.push(`<div class="detail-block"><p class="label">Type</p><p class="value"><span class="node-type-badge">${escapeHtml(details.type)}</span></p></div>`);

  if (details.details) {
    Object.entries(details.details).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return;
      }
      const formattedKey = key.replace(/_/g, " ");
      if (Array.isArray(value)) {
        value = value.join(", ");
      }
      if (key === "url") {
        value = `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">Open PubMed</a>`;
      }
      lines.push(`<div class="detail-block"><p class="label">${escapeHtml(formattedKey)}</p><p class="value">${value}</p></div>`);
    });
  }

  nodeDetail.innerHTML = lines.join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getGraphElement(elementId) {
  if (!currentGraph) {
    return null;
  }
  const node = currentGraph.elements.nodes.find((node) => node.data.id === elementId);
  if (node) {
    return { type: "node", data: node.data };
  }
  const edge = currentGraph.elements.edges.find((edge) => edge.data.id === elementId);
  if (edge) {
    return { type: "edge", data: edge.data };
  }
  return null;
}

function getConnectedPapers(nodeId) {
  if (!currentGraph) {
    return [];
  }
  const relatedPaperIds = new Set();
  currentGraph.elements.edges.forEach((edge) => {
    if (edge.data.source === nodeId && edge.data.target.startsWith("Paper:")) {
      relatedPaperIds.add(edge.data.target);
    }
    if (edge.data.target === nodeId && edge.data.source.startsWith("Paper:")) {
      relatedPaperIds.add(edge.data.source);
    }
  });
  return [...relatedPaperIds]
    .map((paperId) => currentGraph.elements.nodes.find((node) => node.data.id === paperId))
    .filter(Boolean)
    .map((node) => node.data);
}

function renderEvidenceCards(papers) {
  if (!papers || papers.length === 0) {
    return `<p class="muted">No linked PubMed articles were found for this selection.</p>`;
  }
  return papers
    .map((paper) => {
      const classification = paper.classification ? paper.classification.replace(/_/g, " ") : "Evidence";
      return `
        <article class="evidence-card">
          <div class="evidence-card-main">
            <h4>${escapeHtml(paper.title || `PMID ${paper.pmid}`)}</h4>
            <p class="muted">${escapeHtml(String(paper.year || "Unknown"))} · ${escapeHtml(paper.journal || "Unknown journal")}</p>
            <p class="muted">${escapeHtml(String(classification))}</p>
            <p class="paper-snippet">${escapeHtml(paper.abstract_snippet || "No abstract snippet available.")}</p>
          </div>
          <div class="evidence-card-actions">
            <p class="card-pmid">PMID ${escapeHtml(paper.pmid)}</p>
            <a href="${escapeHtml(paper.url || `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`)}" target="_blank" rel="noreferrer" class="btn-secondary small">Open in PubMed</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFindings(findings) {
  const findingsList = document.getElementById("findings-list");
  if (!findingsList) {
    return;
  }
  if (!findings || findings.length === 0) {
    findingsList.innerHTML = `<li>Search a topic to surface strongest evidence, contradictions, and key papers.</li>`;
    return;
  }

  findingsList.innerHTML = findings
    .map((finding) => {
      const relationshipLabel = finding.relationship.replace(/_/g, " ");
      return `
        <li class="finding-item" data-edge-id="${escapeHtml(finding.id)}">
          <button type="button" class="finding-link">
            <strong>${escapeHtml(finding.source.split(":")[1] || finding.source)} ↔ ${escapeHtml(finding.target.split(":")[1] || finding.target)}</strong>
            <span>${escapeHtml(relationshipLabel)} · ${escapeHtml(String(finding.paper_count || 0))} papers</span>
          </button>
        </li>
      `;
    })
    .join("");

  findingsList.querySelectorAll(".finding-link").forEach((button) => {
    button.addEventListener("click", () => {
      const edgeId = button.closest(".finding-item")?.dataset.edgeId;
      if (edgeId) {
        renderDetails({ type: "edge", id: edgeId });
      }
    });
  });
}

function renderDetails(selection) {
  if (!selection) {
    nodeDetail.innerHTML = `<p class="muted">Select a node or edge to inspect supporting PubMed evidence.</p>`;
    return;
  }

  const element = getGraphElement(selection.id);
  if (!element) {
    nodeDetail.innerHTML = `<p class="muted">No details available for the selected item.</p>`;
    return;
  }

  const { type, data } = element;
  const lines = [];
  lines.push(`<div class="detail-block"><p class="label">Name</p><p class="value">${escapeHtml(data.label)}</p></div>`);
  lines.push(`<div class="detail-block"><p class="label">Type</p><p class="value"><span class="node-type-badge">${escapeHtml(type === "node" ? data.type : data.relationship || data.label)}</span></p></div>`);

  if (type === "node") {
    if (data.details) {
      Object.entries(data.details).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          return;
        }
        const formattedKey = key.replace(/_/g, " ");
        if (Array.isArray(value)) {
          value = value.join(", ");
        }
        if (key === "url") {
          value = `<a href="${escapeHtml(value)}" target="_blank" rel="noreferrer">Open PubMed</a>`;
        }
        lines.push(`<div class="detail-block"><p class="label">${escapeHtml(formattedKey)}</p><p class="value">${value}</p></div>`);
      });
    }
    const connectedPapers = getConnectedPapers(data.id);
    lines.push(`<div class="detail-block"><p class="label">Connected papers</p><p class="value">${connectedPapers.length} linked PubMed paper${connectedPapers.length === 1 ? "" : "s"}</p></div>`);
    if (connectedPapers.length > 0) {
      lines.push(`<div class="detail-block"><p class="label">Evidence summary</p><div class="evidence-grid">${renderEvidenceCards(connectedPapers)}</div></div>`);
    }
  } else if (type === "edge") {
    lines.push(`<div class="detail-block"><p class="label">Relationship</p><p class="value">${escapeHtml(data.relationship || data.label)}</p></div>`);
    lines.push(`<div class="detail-block"><p class="label">Confidence</p><p class="value">${escapeHtml(String(data.confidence_score ?? data.confidence ?? 0))}%</p></div>`);
    lines.push(`<div class="detail-block"><p class="label">Support / Contradict</p><p class="value">${escapeHtml(String(data.support_count || 0))} supporting · ${escapeHtml(String(data.contradict_count || 0))} contradicting · ${escapeHtml(String(data.uncertain_count || 0))} uncertain</p></div>`);
    lines.push(`<div class="detail-block"><p class="label">Evidence papers</p><p class="value">${escapeHtml(String((data.evidence_links || []).length))} PubMed paper${(data.evidence_links || []).length === 1 ? "" : "s"}</p></div>`);
    if (data.evidence_links && data.evidence_links.length > 0) {
      lines.push(`<div class="detail-block"><div class="evidence-grid">${renderEvidenceCards(data.evidence_links)}</div></div>`);
    }
  }

  nodeDetail.innerHTML = lines.join("");
}

function getNodeMap(graph) {
  const map = new Map();
  graph.elements.nodes.forEach((node) => map.set(node.data.id, node));
  return map;
}

function getEdgePriority(edge) {
  const weights = {
    supports: 3,
    contradicts: 3,
    associated_with: 2,
    uncertain: 1,
    mentioned_in: 1,
    mentions: 0.7,
  };
  return (edge.data.confidence || 0) * (weights[edge.data.label] || 1);
}

function filterGraph(graph) {
  const threshold = showMoreEnabled ? 45 : 60;
  const nodeMap = getNodeMap(graph);
  const diseaseNode = graph.elements.nodes.find((node) => node.data.type === "Disease");
  const diseaseId = diseaseNode?.data.id;

  const edgeSet = activeYear !== null
    ? graph.elements.edges.filter((edge) => {
        const year = edge.data.year || edge.data.publication_year;
        return year === activeYear;
      })
    : graph.elements.edges;

  const entityEdges = edgeSet
    .filter((edge) => ["supports", "contradicts", "associated_with", "uncertain"].includes(edge.data.label))
    .filter((edge) => (edge.data.confidence || 0) >= threshold)
    .sort((a, b) => getEdgePriority(b) - getEdgePriority(a));

  const selectedEdges = entityEdges.slice(0, showMoreEnabled ? 70 : 30);
  const selectedNodeIds = new Set();
  selectedEdges.forEach((edge) => {
    selectedNodeIds.add(edge.data.source);
    selectedNodeIds.add(edge.data.target);
  });

  const paperEdges = graph.elements.edges
    .filter((edge) => ["mentioned_in", "mentions"].includes(edge.data.label))
    .filter((edge) => (edge.data.confidence || 0) >= threshold)
    .filter((edge) => selectedNodeIds.has(edge.data.source) || selectedNodeIds.has(edge.data.target))
    .sort((a, b) => getEdgePriority(b) - getEdgePriority(a));

  paperEdges.slice(0, 10).forEach((edge) => {
    selectedEdges.push(edge);
    selectedNodeIds.add(edge.data.source);
    selectedNodeIds.add(edge.data.target);
  });

  if (diseaseId) {
    selectedNodeIds.add(diseaseId);
  }

  if (selectedNodeIds.size === 0 && graph.elements.nodes.length) {
    selectedNodeIds.add(graph.elements.nodes[0].data.id);
  }

  const filteredNodes = graph.elements.nodes.filter((node) => selectedNodeIds.has(node.data.id));
  const filteredEdges = selectedEdges.filter((edge) => selectedNodeIds.has(edge.data.source) && selectedNodeIds.has(edge.data.target));

  return {
    elements: {
      nodes: filteredNodes,
      edges: filteredEdges,
    },
    summary: graph.summary,
    insights: graph.insights,
    timeline: graph.timeline,
  };
}

function updateTimeline(timeline) {
  if (!timeline || timeline.length === 0) {
    timelineChart.innerHTML = `<p class="muted">No timeline data available.</p>`;
    return;
  }

  const items = timeline
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((point) => {
      const total = point.supports + point.contradicts + point.uncertain || 1;
      const supportsPct = Math.round((point.supports / total) * 100);
      const contradictsPct = Math.round((point.contradicts / total) * 100);
      const uncertainPct = 100 - supportsPct - contradictsPct;
      const isActive = activeYear === point.year;
      return `
        <div class="timeline-row${isActive ? " selected" : ""}" data-year="${point.year}">
          <div>
            <p class="label">${point.year}</p>
            <p class="muted">Support ${point.supports}, Contradict ${point.contradicts}, Uncertain ${point.uncertain}</p>
          </div>
          <div class="timeline-bar">
            <span style="width:${supportsPct}%;background:#16a34a"></span>
            <span style="width:${contradictsPct}%;background:#dc2626"></span>
            <span style="width:${uncertainPct}%;background:#64748b"></span>
          </div>
        </div>`;
    })
    .join("");

  timelineChart.innerHTML = items;
  timelineChart.querySelectorAll(".timeline-row").forEach((row) => {
    row.addEventListener("click", () => {
      activeYear = parseInt(row.dataset.year, 10);
      renderFilteredGraph();
    });
  });
}

function renderFilteredGraph() {
  if (!currentGraph) {
    return;
  }
  const graphToRender = filterGraph(currentGraph);
  renderGraph(graphToRender, renderDetails);
}

async function executeSearch() {
  clearStatus();
  const term = searchInput.value.trim();
  const entity_type = entityTypeInput.value;
  const min_year = parseInt(minYearInput.value, 10) || undefined;
  const max_year = parseInt(maxYearInput.value, 10) || undefined;

  if (!term) {
    showStatus("Enter a search term before running the graph explorer.", true);
    return;
  }

  setLoading(true);
  try {
    activeYear = null;
    const graph = await fetchLiteratureGraph({ term, entity_type, max_results: 30, min_year, max_year });
    currentGraph = graph;
    renderFilteredGraph();
    updateSummary(graph.summary);
    renderInsights(graph.insights);
    renderFindings(graph.top_findings || []);
    updateTimeline(graph.timeline);
    renderDetails(null);
    showMoreButton.classList.remove("hidden");
  } catch (error) {
    const message = error?.response?.data?.detail || error?.message || "Unable to fetch graph data.";
    showStatus(message, true);
  } finally {
    setLoading(false);
  }
}

function initGraphControls() {
  fitButton?.addEventListener("click", () => getGraphInstance()?.fit(50));
  zoomInButton?.addEventListener("click", () => {
    const cy = getGraphInstance();
    if (cy) cy.zoom(Math.min(cy.zoom() * 1.25, 3));
  });
  zoomOutButton?.addEventListener("click", () => {
    const cy = getGraphInstance();
    if (cy) cy.zoom(Math.max(cy.zoom() / 1.25, 0.15));
  });

  layoutSelect?.addEventListener("change", (event) => {
    currentLayout = event.target.value;
    window.setGraphLayout(currentLayout);
    renderFilteredGraph();
  });

  showMoreButton?.addEventListener("click", () => {
    showMoreEnabled = !showMoreEnabled;
    showMoreButton.textContent = showMoreEnabled ? "Show fewer nodes" : "Show more nodes";
    renderFilteredGraph();
  });
}

searchButton.addEventListener("click", executeSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    executeSearch();
  }
});

initGraphControls();
