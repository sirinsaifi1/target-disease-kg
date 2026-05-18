const API_BASE_URL = "";

async function fetchLiteratureGraph({ term, entity_type, max_results, min_year, max_year }) {
  const params = {
    term,
    entity_type,
    max_results,
  };

  if (min_year) {
    params.min_year = min_year;
  }
  if (max_year) {
    params.max_year = max_year;
  }

  const response = await axios.get(`${API_BASE_URL}/api/graph/literature`, {
    params,
    timeout: 90000,
  });
  return response.data;
}

window.fetchLiteratureGraph = fetchLiteratureGraph;
