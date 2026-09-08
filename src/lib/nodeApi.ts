/**
 * Thin fetch helper for the node -> Express API calls. Surfaces the server's
 * own error message so nodes can show something actionable instead of a bare
 * status code.
 */
export async function postJson<T = any>(path: string, body: any): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(payload?.error || `Request to ${path} failed (${response.status}).`);
  }

  return payload as T;
}
