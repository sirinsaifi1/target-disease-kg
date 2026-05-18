/**
 * Cytoscape graph — biomedical styling, layouts, and interactions.
 */

// Fill + border colors per entity type (bioinformatics palette)
const NODE_TYPE_STYLES = {
  Disease: { color: "#e11d48", border: "#fb7185", shape: "round-rectangle" },
  Gene: { color: "#2563eb", border: "#60a5fa", shape: "ellipse" },
  Compound: { color: "#059669", border: "#34d399", shape: "diamond" },
  Pathway: { color: "#7c3aed", border: "#a78bfa", shape: "hexagon" },
  Protein: { color: "#d97706", border: "#fbbf24", shape: "rectangle" },
};

const DEFAULT_NODE_STYLE = {
  color: "#64748b",
  border: "#94a3b8",
  shape: "ellipse",
};

// Edge colors by relationship (common biomedical predicates)
const RELATIONSHIP_COLORS = {
  ASSOCIATED_WITH: "#f472b6",
  PARTICIPATES_IN: "#a78bfa",
  TARGETS: "#34d399",
  INHIBITS: "#f87171",
  MODULATES: "#22d3ee",
  ENCODES: "#60a5fa",
  TRIGGERS: "#fb923c",
};

const DEFAULT_EDGE_COLOR = "#64748b";

const LEGEND_TYPES = ["Disease", "Gene", "Compound", "Pathway", "Protein"];

let cyInstance = null;
let currentElements = null;

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

  const edges = elements.edges.map((e) => ({
    data: {
      ...e.data,
      edgeColor: getEdgeColor(e.data.label),
    },
  }));

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
        width: 2.5,
        "line-color": "data(edgeColor)",
        "target-arrow-color": "data(edgeColor)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 1.1,
        "curve-style": "bezier",
        "control-point-step-size": 40,
        opacity: 0.85,
        label: "data(label)",
        "font-size": 9,
        "font-weight": 500,
        color: "#cbd5e1",
        "text-outline-color": "#0b1220",
        "text-outline-width": 2,
        "text-rotation": "autorotate",
        "text-margin-y": -10,
        "text-background-color": "#0f172a",
        "text-background-opacity": 0.75,
        "text-background-padding": 3,
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
    evt.target.addClass("hover");
  });
  cyInstance.on("mouseout", "node", (evt) => {
    evt.target.removeClass("hover");
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
    onNodeSelect(node.id());
  });

  cyInstance.on("tap", (evt) => {
    if (evt.target === cyInstance) {
      clearFocusClasses();
      onNodeSelect(null);
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
    Object.entries(RELATIONSHIP_COLORS).forEach(([rel, color]) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="legend-edge" style="background:${color}"></span>
        <span>${rel.replace(/_/g, " ")}</span>
      `;
      relList.appendChild(li);
    });
  }
}

