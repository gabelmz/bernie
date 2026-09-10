/**
 * Where the API lives.
 *
 * Served by `npm run dev`, the Express process is the same origin as the page
 * and this resolves to '' — every path stays relative and nothing changes.
 *
 * Served by anything static (AI Studio, a built dist/, Cloudflare Pages) there
 * is no Express process behind the page, so `POST /api/...` hits a file server
 * and comes back **405 Method Not Allowed**. Pointing this at the deployed
 * Worker gives those builds a real API.
 *
 * Two ways to set it, checked in this order:
 *   1. localStorage `bernie-api-base` — settable at runtime, no rebuild, which
 *      matters on hosts where the build env is not yours to change.
 *   2. VITE_API_BASE_URL at build time.
 */

const OVERRIDE_KEY = 'bernie-api-base';
const API_KEY_STORAGE = 'bernie-api-key';

/** Header the deployed Worker gates on. */
export const API_KEY_HEADER = 'X-Bernie-Key';

function stored(): string {
  try {
    return localStorage.getItem(OVERRIDE_KEY) || '';
  } catch {
    // Private mode and blocked site data both throw rather than return null.
    return '';
  }
}

function configured(): string {
  try {
    return (import.meta as any)?.env?.VITE_API_BASE_URL || '';
  } catch {
    return '';
  }
}

/** Base URL with no trailing slash, or '' meaning same origin. */
export function apiBase(): string {
  return String(stored() || configured() || '').trim().replace(/\/+$/, '');
}

/** Absolute URL for an API path, or the path itself when same-origin. */
export function apiUrl(path: string): string {
  const base = apiBase();
  if (!base) return path;
  return base + (path.startsWith('/') ? path : '/' + path);
}

/**
 * The shared secret for a deployed Worker. Same-origin Express needs none, so
 * this is empty until the app is pointed at a Worker.
 */
export function apiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setApiKey(value: string): void {
  try {
    const trimmed = String(value || '').trim();
    if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    // Nothing to do.
  }
}

/** Headers every API call carries: JSON, plus the key when one is set. */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  const key = apiKey();
  if (key) headers[API_KEY_HEADER] = key;
  return headers;
}

/** Points the app at a deployed API. Pass '' to go back to same-origin. */
export function setApiBase(value: string): void {
  try {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    if (trimmed) localStorage.setItem(OVERRIDE_KEY, trimmed);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // Nothing to do: the app still works against the same origin.
  }
}

/**
 * A 405 from an API path means a file server answered, because no file server
 * accepts POST. Saying so is more use than repeating the status code.
 */
export function describeApiFailure(path: string, status: number): string {
  if (status === 401) {
    return `The API rejected the key for ${path}. Set the right one under Connections & APIs.`;
  }
  if (status === 503) {
    return `The API at ${apiBase() || 'this origin'} has no shared secret configured, so it is refusing requests.`;
  }
  if (status === 405 || status === 501) {
    const base = apiBase();
    return (
      `The API did not answer ${path} (${status}). ` +
      (base
        ? `Requests are going to ${base}, which is not serving the Bernie API.`
        : 'This page is being served by something static, which cannot run the API. ' +
          'Deploy the Worker (npm run worker:deploy) and set its URL under Connections & APIs.')
    );
  }
  return `Request to ${path} failed (${status}).`;
}
