/**
 * Thin fetch helper for the node -> Express API calls. Surfaces the server's
 * own error message so nodes can show something actionable instead of a bare
 * status code.
 */
import { apiHeaders, apiUrl, describeApiFailure } from './apiBase';

export async function postJson<T = any>(path: string, body: any): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || describeApiFailure(path, response.status));
  }

  return payload as T;
}
