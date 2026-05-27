const NODE_TYPE_STYLE = {
  Disease: { color: "#2563eb", border: "#60a5fa", shape: "roundrectangle" },
  Gene: { color: "#f59e0b", border: "#fbbf24", shape: "ellipse" },
  Drug: { color: "#8b5cf6", border: "#c084fc", shape: "diamond" },
  Protein: { color: "#22c55e", border: "#4ade80", shape: "hexagon" },
  Paper: { color: "#64748b", border: "#94a3b8", shape: "triangle" },
};

const EDGE_COLORS = {
  supports: "#16a34a",
  contradicts: "#dc2626",
  uncertain: "#64748b",
  associated_with: "#38bdf8",
  mentioned_in: "#94a3b8",
  mentions: "#a1a1aa",
};

let cyInstance = null;
let graphState = null;
let currentLayoutName = "fcose";
let edgeTooltipElement = null;

function setGraphLayout(layoutName) {
  currentLayoutName = layoutName;
}

function ensureEdgeTooltip() {
  if (edgeTooltipElement) {
    return;
  }
  edgeTooltipElement = document.createElement("div");
  edgeTooltipElement.id = "edge-tooltip";
  edgeTooltipElement.style.position = "fixed";
  edgeTooltipElement.style.zIndex = "10000";
  edgeTooltipElement.style.pointerEvents = "none";
  edgeTooltipElement.style.padding = "0.65rem 0.85rem";
  edgeTooltipElement.style.borderRadius = "0.85rem";
  edgeTooltipElement.style.background = "rgba(15, 23, 42, 0.95)";
  edgeTooltipElement.style.color = "#e2e8f0";
  edgeTooltipElement.style.border = "1px solid rgba(148, 163, 184, 0.2)";
  edgeTooltipElement.style.fontSize = "0.85rem";
  edgeTooltipElement.style.lineHeight = "1.4";
  edgeTooltipElement.style.display = "none";
  edgeTooltipElement.style.maxWidth = "320px";
  edgeTooltipElement.style.boxShadow = "0 20px 40px rgba(15, 23, 42, 0.45)";
  document.body.appendChild(edgeTooltipElement);
}

function showEdgeTooltip(edge, event) {
  if (!edge || !event) {
    return;
  }
  ensureEdgeTooltip();
  const data = edge.data();
  const supportCount = data.support_count || 0;
  const contradictCount = data.contradict_count || 0;
  const paperCount = (data.evidence_links || []).length;
  edgeTooltipElement.innerHTML = `
    <strong>${escapeHtml(String(data.relationship || data.label || "Relationship"))}</strong><br>
    Confidence: ${escapeHtml(String(data.confidence_score ?? data.confidence ?? 0))}%<br>
    Support: ${supportCount} · Contradict: ${contradictCount}<br>
    Evidence: ${paperCount} paper${paperCount === 1 ? "" : "s"}
  `;
  edgeTooltipElement.style.left = `${event.clientX + 14}px`;
  edgeTooltipElement.style.top = `${event.clientY + 14}px`;
  edgeTooltipElement.style.display = "block";
}

function moveEdgeTooltip(event) {
  if (!edgeTooltipElement || edgeTooltipElement.style.display !== "block") {
    return;
  }
  edgeTooltipElement.style.left = `${event.clientX + 14}px`;
  edgeTooltipElement.style.top = `${event.clientY + 14}px`;
}

function hideEdgeTooltip() {
  if (edgeTooltipElement) {
    edgeTooltipElement.style.display = "none";
  }
}

function getGraphInstance() {
  return cyInstance;
}

function getNodeColor(type) {
  return NODE_TYPE_STYLE[type]?.color || "#64748b";
}

function getEdgeColor(label) {
  return EDGE_COLORS[label] || EDGE_COLORS.uncertain;
}

function computeDegrees(edges) {
  const degrees = {};
  edges.forEach((edge) => {
    degrees[edge.data.source] = (degrees[edge.data.source] || 0) + 1;
    degrees[edge.data.target] = (degrees[edge.data.target] || 0) + 1;
  });
  return degrees;
}

function computeImportance(nodes, degrees) {
  const importance = {};
  nodes.forEach((node) => {
    const degree = degrees[node.data.id] || 0;
    const base = {
      Disease: 4,
      Gene: 3,
      Protein: 3,
      Drug: 2,
      Paper: 1,
    }[node.data.type] || 1;
    importance[node.data.id] = base + Math.min(3, Math.floor(degree / 2));
  });
  return importance;
}

function buildGraphElements(graph) {
  graphState = graph;
  const degrees = computeDegrees(graph.elements.edges);
  const importance = computeImportance(graph.elements.nodes, degrees);

  const nodes = graph.elements.nodes.map((node) => {
    const importanceScore = importance[node.data.id] || 1;
    const nodeSize = Math.max(40, Math.min(84, importanceScore * 16));
    const showLabel = importanceScore >= 4 || node.data.type === "Disease";
    return {
      data: {
        ...node.data,
        nodeSize,
        displayLabel: showLabel ? node.data.label : "",
        important: showLabel,
      },
      style: {
        backgroundColor: getNodeColor(node.data.type),
        borderColor: NODE_TYPE_STYLE[node.data.type]?.border || "#94a3b8",
        shape: NODE_TYPE_STYLE[node.data.type]?.shape || "ellipse",
      },
    };
  });

  const edges = graph.elements.edges.map((edge) => {
    const width = Math.max(2, Math.min(8, (edge.data.confidence || 30) / 16));
    return {
      data: {
        ...edge.data,
        edgeColor: getEdgeColor(edge.data.label),
        edgeWidth: width,
      },
      style: {
        lineColor: getEdgeColor(edge.data.label),
        targetArrowColor: getEdgeColor(edge.data.label),
      },
    };
  });

  return [...nodes, ...edges];
}

function getLayoutOptions() {
  const plugin = typeof cytoscapeFcose !== "undefined" ? cytoscapeFcose : typeof fcose !== "undefined" ? fcose : null;
  if (plugin) {
    cytoscape.use(plugin);
  }

  switch (currentLayoutName) {
    case "fcose":
      if (!plugin) {
        return {
          name: "cose",
          animate: true,
          padding: 50,
          randomize: false,
        };
      }
      return {
        name: "fcose",
        animate: true,
        animationDuration: 600,
        idealEdgeLength: 80,
        nodeRepulsion: 8000,
        gravity: 0.1,
        tile: true,
        padding: 50,
      };
    case "breadthfirst":
      return {
        name: "breadthfirst",
        animate: true,
        directed: true,
        spacingFactor: 1.8,
        padding: 50,
      };
    case "cose-bilkent":
      return {
        name: "cose-bilkent",
        animate: true,
        animationDuration: 600,
        idealEdgeLength: 100,
        nodeRepulsion: 9000,
        gravity: 0.2,
        padding: 50,
      };
    case "concentric":
    default:
      return {
        name: "concentric",
        animate: true,
        animationDuration: 600,
        concentric: (node) => {
          return {
            Disease: 3,
            Gene: 2,
            Protein: 2,
            Drug: 1,
            Paper: 0,
          }[node.data("type")] || 0;
        },
        levelWidth: () => 1,
        padding: 50,
      };
  }
}

function renderGraph(graph, onNodeSelect) {
  const graphPlaceholder = document.getElementById("graph-placeholder");
  const graphContainer = document.getElementById("cy");

  if (!graph || !graph.elements || !graph.elements.nodes.length) {
    graphPlaceholder.classList.remove("hidden");
    graphContainer.classList.add("hidden");
    return;
  }

  graphPlaceholder.classList.add("hidden");
  graphContainer.classList.remove("hidden");

  if (cyInstance) {
    cyInstance.destroy();
  }

  cyInstance = cytoscape({
    container: graphContainer,
    elements: buildGraphElements(graph),
    style: [
      {
        selector: "node",
        style: {
          label: "data(displayLabel)",
          "text-valign": "center",
          "text-halign": "center",
          "text-wrap": "wrap",
          "text-max-width": 90,
          width: "data(nodeSize)",
          height: "data(nodeSize)",
          "font-size": 12,
          "text-outline-color": "#0f172a",
          "text-outline-width": 3,
          "border-width": 2,
          "background-opacity": 0.98,
          "border-opacity": 1,
        },
      },
      {
        selector: "node[important = false], node[important = 'false']",
        style: {
          "text-opacity": 0,
        },
      },
      {
        selector: "edge",
        style: {
          width: "data(edgeWidth)",
          "line-color": "data(edgeColor)",
          "target-arrow-color": "data(edgeColor)",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          opacity: 0.85,
          label: "data(label)",
          "font-size": 8,
          color: "#e2e8f0",
          "text-outline-color": "#0f172a",
          "text-outline-width": 3,
          "text-rotation": "autorotate",
        },
      },
      {
        selector: ".dimmed",
        style: {
          opacity: 0.12,
        },
      },
      {
        selector: ".highlighted",
        style: {
          "border-width": 4,
          "border-color": "#f59e0b",
          opacity: 1,
        },
      },
      {
        selector: ".neighbor",
        style: {
          "border-color": "#38bdf8",
          "border-width": 3,
        },
      },
      {
        selector: ".hidden-node",
        style: {
          display: "none",
        },
      },
    ],
    layout: getLayoutOptions(),
    minZoom: 0.12,
    maxZoom: 3,
    wheelSensitivity: 0.17,
    boxSelectionEnabled: false,
  });

  console.log("[graph] Cytoscape initialized", { nodeCount: graph.elements.nodes.length, edgeCount: graph.elements.edges.length });

  cyInstance.on("tap", "node", (evt) => {
    const node = evt.target;
    console.log("[graph] Node tapped:", node.id(), node.data());
    focusNode(node);
    if (typeof onNodeSelect === "function") {
      onNodeSelect({ type: "node", id: node.id() });
    }
  });

  cyInstance.on("tap", "edge", (evt) => {
    const edge = evt.target;
    console.log("[graph] Edge tapped:", edge.id(), edge.data());
    focusNode(edge);
    if (typeof onNodeSelect === "function") {
      onNodeSelect({ type: "edge", id: edge.id() });
    }
  });

  cyInstance.on("tap", (evt) => {
    if (evt.target === cyInstance) {
      console.log("[graph] Background tapped");
      clearFocus();
    }
  });

  cyInstance.on("dblclick", "node", () => {
    clearFocus();
  });

  cyInstance.on("cxttap", "node", (evt) => {
    collapseNeighborhood(evt.target);
    if (typeof onNodeSelect === "function") {
      onNodeSelect({ type: "node", id: evt.target.id() });
    }
  });

  cyInstance.on("mouseover", "node", (evt) => {
    const node = evt.target;
    if (!node.data("important")) {
      node.data("displayLabel", node.data("label"));
    }
  });

  cyInstance.on("mouseout", "node", (evt) => {
    const node = evt.target;
    if (!node.data("important")) {
      node.data("displayLabel", "");
    }
  });

  cyInstance.on("mouseover", "edge", (evt) => {
    showEdgeTooltip(evt.target, evt.originalEvent);
  });

  cyInstance.on("mousemove", "edge", (evt) => {
    moveEdgeTooltip(evt.originalEvent);
  });

  cyInstance.on("mouseout", "edge", () => {
    hideEdgeTooltip();
  });

  cyInstance.on("layoutstop", () => {
    cyInstance.fit(50);
  });
}

function focusNode(node) {
  if (!cyInstance || !node) {
    return;
  }

  cyInstance.elements().removeClass("dimmed highlighted neighbor");
  node.addClass("highlighted");
  const neighborhood = node.closedNeighborhood();
  neighborhood.addClass("neighbor");
  cyInstance.elements().not(neighborhood).addClass("dimmed");
}

function clearFocus() {
  if (!cyInstance) {
    return;
  }
  cyInstance.elements().removeClass("dimmed highlighted neighbor hidden-node");
}

function collapseNeighborhood(node) {
  if (!cyInstance || !node) {
    return;
  }
  const keep = node.closedNeighborhood();
  cyInstance.elements().not(keep).addClass("hidden-node");
  keep.removeClass("dimmed");
}

function getNodeDetails(nodeId) {
  if (!graphState) {
    return null;
  }
  const node = graphState.elements.nodes.find((item) => item.data.id === nodeId);
  return node?.data || null;
}

window.renderGraph = renderGraph;
window.getGraphInstance = getGraphInstance;
window.getNodeDetails = getNodeDetails;
window.setGraphLayout = setGraphLayout;
