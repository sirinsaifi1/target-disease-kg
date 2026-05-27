/**
 * Cytoscape graph — biomedical styling, layouts, and interactions.
 */

/** Prevent XSS when inserting user data into HTML */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Fill + border colors per entity type
const NODE_TYPE_STYLES = {
  Disease: { color: "#2563eb", border: "#60a5fa", shape: "ellipse" },
  Gene: { color: "#f97316", border: "#fb923c", shape: "hexagon" },
  Drug: { color: "#8b5cf6", border: "#c084fc", shape: "diamond" },
  Protein: { color: "#16a34a", border: "#4ade80", shape: "round-rectangle" },
  Paper: { color: "#64748b", border: "#94a3b8", shape: "rectangle" },
};

const DEFAULT_NODE_STYLE = {
  color: "#475569",
  border: "#64748b",
  shape: "ellipse",
};

// Edge colors by evidence classification and relationship type
const RELATIONSHIP_COLORS = {
  SUPPORTS: "#22c55e",
  CONTRADICTS: "#ef4444",
  UNCERTAIN: "#9ca3af",
  ASSOCIATED_WITH: "#60a5fa",
  MENTIONS: "#38bdf8",
  MENTIONED_IN: "#94a3b8",
};

const DEFAULT_EDGE_COLOR = "#64748b";

const LEGEND_TYPES = ["Disease", "Gene", "Drug", "Protein", "Paper"];

/** Convert classification to edge width based on confidence score */
function getEdgeWidth(confidence) {
  const score = Number(confidence ?? 0);
  return Math.max(2.5, Math.min(7, 2.5 + score / 20));
}

let cyInstance = null;
let currentElements = null;
const tooltipEl = document.getElementById("cy-tooltip");

/** Resolve style for a node type */
function getNodeStyle(type) {
  return NODE_TYPE_STYLES[type] || DEFAULT_NODE_STYLE;
}

/** Public: fill color for legend / sidebar */
function getNodeColor(type) {
  return getNodeStyle(type).color;
}

/** Edge stroke color from relationship label */
function getEdgeColor(relationship) {
  const key = String(relationship || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return RELATIONSHIP_COLORS[key] || DEFAULT_EDGE_COLOR;
}

function showTooltip(html, x, y) {
  if (!tooltipEl) return;
  tooltipEl.innerHTML = html;
  tooltipEl.style.left = `${x + 18}px`;
  tooltipEl.style.top = `${y + 18}px`;
  tooltipEl.classList.remove("hidden");
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.classList.add("hidden");
}

/** Count connections per node for size scaling */
function computeDegrees(elements) {
  const degrees = {};
  elements.nodes.forEach((n) => {
    degrees[n.data.id] = 0;
  });
  elements.edges.forEach((e) => {
    const { source, target } = e.data;
    if (degrees[source] !== undefined) degrees[source]++;
    if (degrees[target] !== undefined) degrees[target]++;
  });
  return degrees;
}

/** Map degree → node size (hub nodes appear larger) */
function sizeFromDegree(degree, minDeg, maxDeg) {
  const minSize = 42;
  const maxSize = 72;
  if (maxDeg <= minDeg) return 52;
  const t = (degree - minDeg) / (maxDeg - minDeg);
  return Math.round(minSize + t * (maxSize - minSize));
}

/**
 * Build Cytoscape elements with type class, colors, and size.
 */
function buildCyElements(elements) {
  const degrees = computeDegrees(elements);
  const degValues = Object.values(degrees);
  const minDeg = Math.min(...degValues, 0);
  const maxDeg = Math.max(...degValues, 1);

  const nodes = elements.nodes.map((n) => {
    const style = getNodeStyle(n.data.type);
    const degree = degrees[n.data.id] || 0;
    const typeClass = "type-" + n.data.type.toLowerCase().replace(/\s+/g, "-");

    return {
      classes: typeClass,
      data: {
        ...n.data,
        color: style.color,
        borderColor: style.border,
        shape: style.shape,
        nodeSize: sizeFromDegree(degree, minDeg, maxDeg),
        degree,
      },
    };
  });

  const edges = elements.edges.map((e) => {
    const confidence = e.data.confidence_score ?? e.data.confidence ?? 0;
    return {
      data: {
        ...e.data,
        edgeColor: getEdgeColor(e.data.label),
        edgeWidth: getEdgeWidth(confidence),
      },
    };
  });

  return [...nodes, ...edges];
}

/** Cytoscape stylesheet — biomedical entity visualization */
function getGraphStylesheet() {
  return [
    // --- Base node ---
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 6,
        "font-size": 11,
        "font-weight": 600,
        "font-family": "system-ui, sans-serif",
        color: "#f1f5f9",
        "text-outline-color": "#0b1220",
        "text-outline-width": 2,
        "text-max-width": 90,
        "text-wrap": "ellipsis",
        width: "data(nodeSize)",
        height: "data(nodeSize)",
        shape: "data(shape)",
        "background-color": "data(color)",
        "background-opacity": 0.92,
        "border-width": 2.5,
        "border-color": "data(borderColor)",
        "border-opacity": 1,
        "overlay-padding": 6,
        "transition-property":
          "background-color, border-color, border-width, width, height",
        "transition-duration": 0.2,
      },
    },
    // --- Type-specific fine tuning ---
    {
      selector: "node[type = 'Disease']",
      style: { "background-opacity": 0.95 },
    },
    {
      selector: "node[type = 'Compound']",
      style: { "text-margin-y": 8 },
    },
    {
      selector: "node[type = 'Pathway']",
      style: { "font-size": 10 },
    },
    // --- Interaction states ---
    {
      selector: "node:active",
      style: {
        "overlay-color": "#22d3ee",
        "overlay-opacity": 0.12,
      },
    },
    {
      selector: "node.hover",
      style: {
        "border-width": 4,
        "z-index": 10,
        "background-opacity": 1,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#22d3ee",
        "border-width": 4,
        "background-opacity": 1,
        "z-index": 20,
      },
    },
    {
      selector: "node.neighbor",
      style: {
        "border-color": "#67e8f9",
        "border-width": 3,
        "background-opacity": 1,
        "z-index": 15,
      },
    },
    {
      selector: "node.dimmed",
      style: { opacity: 0.12 },
    },
    {
      selector: "node.highlighted",
      style: {
        "border-color": "#fbbf24",
        "border-width": 4,
        "background-opacity": 1,
        "z-index": 12,
      },
    },
    // --- Edges ---
    {
      selector: "edge",
      style: {
        width: "data(edgeWidth)",
        "line-color": "data(edgeColor)",
        "target-arrow-color": "data(edgeColor)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.1,
        "curve-style": "bezier",
        "control-point-step-size": 40,
        opacity: 0.9,
        label: "data(label)",
        "font-size": 9,
        "font-weight": 500,
        color: "#cbd5e1",
        "text-outline-color": "#0b1220",
        "text-outline-width": 2,
        "text-rotation": "autorotate",
        "text-margin-y": -10,
        "text-background-color": "#0f172a",
        "text-background-opacity": 0.85,
        "text-background-padding": 4,
        "text-background-shape": "roundrectangle",
      },
    },
    {
      selector: "edge.incident",
      style: {
        width: 3.5,
        opacity: 1,
        "z-index": 8,
      },
    },
    {
      selector: "edge.dimmed",
      style: { opacity: 0.08 },
    },
    {
      selector: "edge.highlighted",
      style: { width: 3, opacity: 1 },
    },
  ];
}


/** Pick best layout — cose-bilkent when extension script is loaded */
function runLayout(cy) {
  const nodeCount = cy.nodes().length;
  const idealLength = nodeCount > 15 ? 140 : 110;
  const useBilkent = typeof cytoscapeCoseBilkent !== "undefined";

  if (useBilkent) {
    cy.layout({
      name: "cose-bilkent",
      animate: true,
      animationDuration: 800,
      randomize: false,
      nodeRepulsion: 9000,
      idealEdgeLength: idealLength,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.35,
      numIter: 2500,
      tile: true,
      padding: 50,
    }).run();
    return;
  }

  cy.layout({
    name: "cose",
    animate: true,
    animationDuration: 600,
    padding: 50,
    nodeRepulsion: 10000,
    idealEdgeLength: idealLength,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    gravity: 0.4,
    numIter: 1500,
  }).run();
}

/** Clear focus / search / hover classes */
function clearFocusClasses() {
  if (!cyInstance) return;
  cyInstance.elements().removeClass(
    "hover neighbor incident highlighted dimmed"
  );
}

/** Highlight neighbors and edges of the selected node */
function focusNode(node) {
  clearFocusClasses();
  if (!node) return;

  const neighborhood = node.closedNeighborhood();
  neighborhood.nodes().not(node).addClass("neighbor");
  neighborhood.edges().addClass("incident");
}

/** Wire graph toolbar once (fit / zoom / relayout) */
let toolbarReady = false;
function setupGraphToolbar() {
  if (toolbarReady) return;
  toolbarReady = true;

  document.getElementById("btn-fit")?.addEventListener("click", () => {
    cyInstance?.fit(undefined, 50);
  });
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    if (!cyInstance) return;
    cyInstance.zoom(Math.min(cyInstance.zoom() * 1.25, 3.5));
  });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    if (!cyInstance) return;
    cyInstance.zoom(Math.max(cyInstance.zoom() / 1.25, 0.15));
  });
  document.getElementById("btn-relayout")?.addEventListener("click", () => {
    if (cyInstance) runLayout(cyInstance);
  });
}

/** Hover highlight */
function setupHoverHandlers() {
  if (!cyInstance) return;

  cyInstance.on("mouseover", "node", (evt) => {
    const node = evt.target;
    node.addClass("hover");
    const data = node.data();
    const tooltipHtml = `<strong>${escapeHtml(data.type || "Node")}</strong>
      <p>${escapeHtml(data.label || data.id)}</p>
      <p class="muted">Click to view evidence and papers</p>`;
    const pos = evt.renderedPosition || evt.position || { x: 0, y: 0 };
    showTooltip(tooltipHtml, pos.x, pos.y);
  });

  cyInstance.on("mouseout", "node", (evt) => {
    evt.target.removeClass("hover");
    hideTooltip();
  });

  cyInstance.on("mouseover", "edge", (evt) => {
    const edge = evt.target;
    edge.addClass("highlighted");
    const data = edge.data();
    const score = data.confidence_score ?? data.confidence ?? 0;
    const support = data.support_count ?? 0;
    const contradict = data.contradict_count ?? 0;
    const tooltipHtml = `<strong>Relationship</strong>
      <p>${escapeHtml(String(data.label || data.relationship || "Edge"))}</p>
      <p>Confidence: ${escapeHtml(String(score))}%</p>
      <p>Support: ${escapeHtml(String(support))}, Contradict: ${escapeHtml(String(contradict))}</p>`;
    const pos = evt.renderedPosition || evt.position || { x: 0, y: 0 };
    showTooltip(tooltipHtml, pos.x, pos.y);
  });

  cyInstance.on("mouseout", "edge", (evt) => {
    evt.target.removeClass("highlighted");
    hideTooltip();
  });
}

/**
 * Render or replace the knowledge graph.
 */
function renderGraph(elements, onNodeSelect) {
  currentElements = elements;

  const container = document.getElementById("cy");
  const placeholder = document.getElementById("graph-placeholder");
  const toolbar = document.getElementById("graph-toolbar");

  placeholder.classList.add("hidden");
  container.classList.remove("hidden");
  toolbar?.classList.remove("hidden");

  if (cyInstance) {
    cyInstance.destroy();
    cyInstance = null;
  }

  cyInstance = cytoscape({
    container,
    elements: buildCyElements(elements),
    style: getGraphStylesheet(),
    minZoom: 0.15,
    maxZoom: 3.5,
    wheelSensitivity: 0.18,
    boxSelectionEnabled: false,
  });

  runLayout(cyInstance);
  setupHoverHandlers();
  setupGraphToolbar();

  cyInstance.on("tap", "node", (evt) => {
    const node = evt.target;
    focusNode(node);
    onNodeSelect(node.id(), null);
  });

  cyInstance.on("tap", "edge", (evt) => {
    const edge = evt.target;
    clearFocusClasses();
    edge.addClass("highlighted");
    onNodeSelect(null, edge.id());
  });

  cyInstance.on("tap", (evt) => {
    if (evt.target === cyInstance) {
      clearFocusClasses();
      onNodeSelect(null, null);
    }
  });

  // Fit after layout finishes
  cyInstance.one("layoutstop", () => {
    cyInstance.fit(undefined, 55);
  });
}

/**
 * Search filter — highlight matches, dim the rest, zoom to results.
 */
function applySearchFilter(query) {
  if (!cyInstance || !currentElements) return;

  const q = query.trim().toLowerCase();

  cyInstance.nodes().forEach((n) => n.removeClass("dimmed highlighted"));
  cyInstance.edges().forEach((e) => e.removeClass("dimmed highlighted"));

  // Cleared search → show full graph again
  if (!q) {
    cyInstance.animate({
      fit: { eles: cyInstance.elements(), padding: 55 },
      duration: 350,
      easing: "ease-out",
    });
    return;
  }

  cyInstance.nodes().forEach((node) => {
    const label = String(node.data("label")).toLowerCase();
    if (label.includes(q)) {
      node.addClass("highlighted");
    } else {
      node.addClass("dimmed");
    }
  });

  cyInstance.edges().addClass("dimmed");
  cyInstance.edges().forEach((edge) => {
    const src = edge.source();
    const tgt = edge.target();
    if (src.hasClass("highlighted") || tgt.hasClass("highlighted")) {
      edge.removeClass("dimmed");
      edge.addClass("highlighted");
    }
  });

  const matched = cyInstance.nodes(".highlighted");

  if (matched.length === 0) {
    return;
  }

  // Zoom to matches + their connections for context
  const focus =
    matched.length === 1
      ? matched.closedNeighborhood()
      : matched.union(matched.connectedEdges()).union(matched);

  cyInstance.animate({
    fit: { eles: focus, padding: matched.length === 1 ? 70 : 90 },
    duration: 400,
    easing: "ease-out",
  });
}

/** Sidebar node details */
function getNodeDetails(nodeId, elements) {
  const node = elements.nodes.find((n) => n.data.id === nodeId);
  if (!node) return null;

  const relationships = [];
  const neighborIds = new Set();

  elements.edges.forEach((edge) => {
    const { source, target, label } = edge.data;
    if (source === nodeId) {
      neighborIds.add(target);
      const t = elements.nodes.find((n) => n.data.id === target);
      relationships.push(`→ ${t ? t.data.label : target} (${label})`);
    }
    if (target === nodeId) {
      neighborIds.add(source);
      const s = elements.nodes.find((n) => n.data.id === source);
      relationships.push(`← ${s ? s.data.label : source} (${label})`);
    }
  });

  return {
    id: node.data.id,
    name: node.data.label,
    type: node.data.type,
    nodeData: node.data,
    connectedCount: neighborIds.size,
    relationships,
  };
}

/** Legend with shape previews + relationship colors */
function renderLegend(extraTypes) {
  const list = document.getElementById("legend-list");
  const relList = document.getElementById("legend-relationships");
  if (!list) return;

  list.innerHTML = "";
  const extras = (extraTypes || []).filter((t) => !LEGEND_TYPES.includes(t));

  [...LEGEND_TYPES, ...extras].forEach((type) => {
    const style = getNodeStyle(type);
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="legend-shape legend-shape--${type.toLowerCase()}" style="--legend-color:${style.color};--legend-border:${style.border}"></span>
      <span>${type}</span>
    `;
    list.appendChild(li);
  });

  if (relList) {
    relList.innerHTML = "";
    ["SUPPORTS", "CONTRADICTS", "UNCERTAIN"].forEach((rel) => {
      const color = RELATIONSHIP_COLORS[rel] || DEFAULT_EDGE_COLOR;
      const label = rel === "SUPPORTS" ? "Supporting" : rel === "CONTRADICTS" ? "Contradicting" : "Uncertain";
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="legend-edge" style="background:${color}"></span>
        <span>${label}</span>
      `;
      relList.appendChild(li);
    });
  }
}

