// Central API base URL utility
// On VPS or localhost: VITE_API_URL is empty — relative paths work unchanged
// On Vercel+Render: set VITE_API_URL=https://your-render-backend.onrender.com

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

/**
 * Returns the Authorization header object if a token exists in localStorage,
 * otherwise returns an empty object. Use this in every fetch call that hits
 * a protected backend route.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('atmilan-token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Drop-in replacement for fetch() that automatically injects the auth token.
 * Accepts the same arguments as the native fetch API.
 * Also prepends API_BASE so calls work on Vercel+Render deployments.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  return fetch(apiUrl(url), {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}
