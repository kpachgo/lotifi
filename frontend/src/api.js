export async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      const message = body?.message || body?.error;
      throw new Error(typeof message === 'string' ? message : `Error HTTP ${response.status}`);
    }
    const message = await response.text();
    throw new Error(message || `Error HTTP ${response.status}`);
  }
  return response.json();
}
