/**
 * Search autocomplete — suggests node names from the loaded graph.
 */

const MAX_SUGGESTIONS = 8;

let allSuggestions = [];
let activeIndex = -1;
let searchInputEl = null;
const suggestionsEl = document.getElementById("search-suggestions");

/** Build suggestion list from graph nodes (unique labels) */
function setSearchSuggestions(elements) {
  const seen = new Set();
  allSuggestions = [];
  hideSuggestions();

  if (!elements) return;

  elements.nodes.forEach((n) => {
    const label = n.data.label;
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allSuggestions.push({
        label,
        type: n.data.type,
      });
    }
  });

  allSuggestions.sort((a, b) => a.label.localeCompare(b.label));
}

/** Filter suggestions by query */
function getMatchingSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return allSuggestions
    .filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q)
    )
    .slice(0, MAX_SUGGESTIONS);
}

/** Highlight the matched part of the label */
function highlightMatch(text, query) {
  const q = query.trim();
  if (!q) return escapeHtml(text);

  const lower = text.toLowerCase();
  const qi = lower.indexOf(q.toLowerCase());
  if (qi === -1) return escapeHtml(text);

  const before = escapeHtml(text.slice(0, qi));
  const match = escapeHtml(text.slice(qi, qi + q.length));
  const after = escapeHtml(text.slice(qi + q.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function hideSuggestions() {
  if (!suggestionsEl) return;
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
  searchInputEl.setAttribute("aria-expanded", "false");
  activeIndex = -1;
}

function showSuggestions(matches, query) {
  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsEl.innerHTML = matches
    .map((s, i) => {
      const color = getNodeColor(s.type);
      return `
        <li
          class="search-suggestion-item${i === activeIndex ? " active" : ""}"
          role="option"
          data-label="${encodeURIComponent(s.label)}"
          data-index="${i}"
        >
          <span class="search-suggestion-dot" style="background:${color}"></span>
          <span class="search-suggestion-text">${highlightMatch(s.label, query)}</span>
          <span class="search-suggestion-type">${escapeHtml(s.type)}</span>
        </li>`;
    })
    .join("");

  suggestionsEl.classList.remove("hidden");
  searchInputEl.setAttribute("aria-expanded", "true");
}

/** Apply search text and zoom (shared with manual typing) */
function applySearch(value) {
  searchInputEl.value = value;
  applySearchFilter(value);
}

/** User picked a suggestion */
function selectSuggestion(label) {
  applySearch(label);
  hideSuggestions();
  searchInputEl.focus();
}

/** Render dropdown for current input */
function updateSuggestionsDropdown() {
  const query = searchInputEl.value;
  const matches = getMatchingSuggestions(query);
  activeIndex = -1;
  showSuggestions(matches, query);
}

/** Keyboard navigation in the list */
function handleSearchKeydown(e) {
  const items = suggestionsEl.querySelectorAll(".search-suggestion-item");
  const isOpen = !suggestionsEl.classList.contains("hidden") && items.length > 0;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!isOpen) {
      updateSuggestionsDropdown();
      return;
    }
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (!isOpen) return;
    activeIndex = Math.max(activeIndex - 1, 0);
    items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }

  if (e.key === "Enter") {
    if (isOpen && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(decodeURIComponent(items[activeIndex].dataset.label));
    }
    return;
  }

  if (e.key === "Escape") {
    hideSuggestions();
  }
}

/** Wire input events once on page load */
function initSearchAutocomplete(inputEl) {
  searchInputEl = inputEl;
  searchInputEl.addEventListener("input", () => {
    applySearchFilter(searchInputEl.value);
    updateSuggestionsDropdown();
  });

  searchInputEl.addEventListener("focus", () => {
    if (searchInputEl.value.trim()) {
      updateSuggestionsDropdown();
    }
  });

  searchInputEl.addEventListener("keydown", handleSearchKeydown);

  suggestionsEl.addEventListener("click", (e) => {
    const item = e.target.closest(".search-suggestion-item");
    if (item) {
      selectSuggestion(decodeURIComponent(item.dataset.label));
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      hideSuggestions();
    }
  });
}

