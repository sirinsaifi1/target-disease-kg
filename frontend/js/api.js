/**
 * API helper — sends CSV to FastAPI using Axios (loaded from CDN).
 */

const API_BASE_URL = getApiBaseUrl();

function getApiBaseUrl() {
  const origin = window.location.origin;

  // GitHub Codespaces forwarded ports use hostnames like
  // https://<name>-3000.app.github.dev and https://<name>-8000.app.github.dev.
  if (origin.includes(".app.github.dev") && origin.includes("-3000.")) {
    return origin.replace("-3000.", "-8000.");
  }

  // Local frontend dev server on port 3000 should talk to backend on port 8000.
  if (origin.includes("localhost:3000") || origin.includes("127.0.0.1:3000")) {
    return "http://localhost:8000";
  }

  return origin;
}

/**
 * Upload a CSV file and return graph JSON + summary.
 * @param {File} file
 * @returns {Promise<{ elements: object, summary: object }>}
 */
async function uploadCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
    timeout: 60000,
  });

  return response.data;
}
