/**
 * The half of the integration plumbing that has no Node in it: config
 * resolution from an env bag, a fetch wrapper, response reading and error
 * classification.
 *
 * It exists so the same operation runner can serve the Express dev server and
 * the Cloudflare Worker. Express passes `process.env`; the Worker passes its
 * own `env` binding. Nothing here may import express, @google/genai, or any
 * node: module.
 */

import { IntegrationId, resolveConfig } from '../lib/integrationCore';

/** The shape both runtimes hand in: a flat bag of string settings. */
export type EnvSource = Record<string, any>;

/** Whatever `process.env` is here, or nothing on a runtime without one. */
export function ambientEnv(): EnvSource {
  return typeof process !== 'undefined' && process?.env ? process.env : {};
}

/**
 * Server-side defaults for each integration. Request configs (sent from the
 * Integrations page) take precedence, so these only act as a fallback for
 * headless / deployed runs.
 */
export function envConfig(id: IntegrationId, env: EnvSource = ambientEnv()): Record<string, any> {
  switch (id) {
    case 'asana':
      return {
        accessToken: env.ASANA_ACCESS_TOKEN,
        workspaceGid: env.ASANA_WORKSPACE_GID,
        projectGid: env.ASANA_PROJECT_GID,
      };
    case 'keepa':
      return {
        apiKey: env.KEEPA_API_KEY,
        domain: env.KEEPA_DOMAIN ? Number(env.KEEPA_DOMAIN) : undefined,
      };
    case 'supabase':
      return {
        url: env.SUPABASE_URL,
        apiKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY,
        table: env.SUPABASE_TABLE,
      };
    case 'sheets':
      return {
        spreadsheetId: env.SHEETS_SPREADSHEET_ID,
        sheetName: env.SHEETS_TAB_NAME,
      };
    case 'gemini':
      return {
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL,
      };
    case 'openrouter':
      return {
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        baseUrl: env.OPENROUTER_BASE_URL,
      };
    case 'huggingface':
      return {
        token: env.HUGGINGFACE_TOKEN,
        model: env.HUGGINGFACE_MODEL,
      };
    case 'opencode':
      return {
        baseUrl: env.OPENCODE_BASE_URL,
        apiKey: env.OPENCODE_API_KEY,
      };
    case 'github':
      return {
        token: env.GITHUB_TOKEN,
        owner: env.GITHUB_OWNER,
        repo: env.GITHUB_REPO,
        apiBaseUrl: env.GITHUB_API_BASE_URL,
      };
    default:
      return {};
  }
}

export function mergedConfig<T extends Record<string, any>>(
  id: IntegrationId,
  requestConfig: any,
  env: EnvSource = ambientEnv()
): T {
  return resolveConfig(envConfig(id, env) as T, (requestConfig || {}) as Partial<T>);
}

export async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Fetch that names the host it could not reach. A refused or unresolvable host
 * otherwise throws a bare "fetch failed", which tells the user nothing.
 */
export async function probe(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: any) {
    const cause = err?.cause?.code || err?.message || 'network error';
    throw new Error(`Could not reach ${url} (${cause}).`);
  }
}

export function errorStatus(err: any): number {
  // Config problems surfaced by the builders are the caller's fault.
  return /required|provide at least|set a project|no rows/i.test(String(err?.message)) ? 400 : 500;
}
