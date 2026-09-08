/**
 * Shared plumbing for the integration routes: config resolution with env
 * fallbacks, credential gating, response reading, and a fetch wrapper that
 * reports unreachable hosts usefully.
 */

import type express from "express";
import { GoogleGenAI } from "@google/genai";
import {
  GeminiConfig,
  IntegrationId,
  resolveConfig,
  validateIntegrationConfig,
} from "../lib/integrationCore";

export const AI_MODEL = "gemini-3.1-pro-preview";

export const GEMINI_UNCONFIGURED = "Gemini is not configured. Add an API key under Connections & APIs.";

/** Process-wide client built from GEMINI_API_KEY, when one is present. */
export let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  console.warn("Failed to initialize Gemini API", error);
}

/**
 * Server-side defaults for each integration. Request configs (sent from the
 * Integrations page) take precedence, so env vars only act as a fallback for
 * headless / deployed runs.
 */
export function envConfig(id: IntegrationId): Record<string, any> {
  switch (id) {
    case "asana":
      return {
        accessToken: process.env.ASANA_ACCESS_TOKEN,
        workspaceGid: process.env.ASANA_WORKSPACE_GID,
        projectGid: process.env.ASANA_PROJECT_GID,
      };
    case "keepa":
      return {
        apiKey: process.env.KEEPA_API_KEY,
        domain: process.env.KEEPA_DOMAIN ? Number(process.env.KEEPA_DOMAIN) : undefined,
      };
    case "supabase":
      return {
        url: process.env.SUPABASE_URL,
        apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
        table: process.env.SUPABASE_TABLE,
      };
    case "sheets":
      return {
        spreadsheetId: process.env.SHEETS_SPREADSHEET_ID,
        sheetName: process.env.SHEETS_TAB_NAME,
      };
    case "gemini":
      return {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL,
      };
    case "openrouter":
      return {
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL,
        baseUrl: process.env.OPENROUTER_BASE_URL,
      };
    case "huggingface":
      return {
        token: process.env.HUGGINGFACE_TOKEN,
        model: process.env.HUGGINGFACE_MODEL,
      };
    case "opencode":
      return {
        baseUrl: process.env.OPENCODE_BASE_URL,
        apiKey: process.env.OPENCODE_API_KEY,
      };
    case "github":
      return {
        token: process.env.GITHUB_TOKEN,
        owner: process.env.GITHUB_OWNER,
        repo: process.env.GITHUB_REPO,
        apiBaseUrl: process.env.GITHUB_API_BASE_URL,
      };
    default:
      return {};
  }
}

export function mergedConfig<T extends Record<string, any>>(id: IntegrationId, requestConfig: any): T {
  return resolveConfig(envConfig(id) as T, (requestConfig || {}) as Partial<T>);
}

/** Rejects the request when required credentials are still missing. */
export function assertConfigured(id: IntegrationId, config: Record<string, any>, res: express.Response): boolean {
  const { valid, missing } = validateIntegrationConfig(id, config);
  if (!valid) {
    res.status(400).json({
      error: `${id} is not configured yet: missing ${missing.join(", ")}.`,
      missing,
    });
    return false;
  }
  return true;
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
 * Resolves the Gemini client and model for one request. A key configured on the
 * Connections page takes precedence over GEMINI_API_KEY; the process-wide
 * client is reused whenever the key matches the one it was built with.
 */
export function geminiFor(requestConfig: any): { client: GoogleGenAI; model: string } | null {
  const config = mergedConfig<GeminiConfig>("gemini", requestConfig);
  const apiKey = String(config.apiKey || "").trim();
  const model = String(config.model || "").trim() || AI_MODEL;

  if (!apiKey) return ai ? { client: ai, model } : null;
  if (ai && apiKey === String(process.env.GEMINI_API_KEY || "").trim()) return { client: ai, model };

  try {
    return { client: new GoogleGenAI({ apiKey }), model };
  } catch (err) {
    console.warn("Failed to build a Gemini client for this request", err);
    return null;
  }
}


/**
 * Fetch for connection tests. A refused or unresolvable host throws a bare
 * "fetch failed", so this restates it in terms of the URL the user typed.
 */
export async function probe(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: any) {
    const cause = err?.cause?.code || err?.message || "network error";
    throw new Error(`Could not reach ${url} (${cause}).`);
  }
}

export function errorStatus(err: any): number {
  // Config problems surfaced by the builders are the caller's fault.
  return /required|provide at least|set a project|no rows/i.test(String(err?.message)) ? 400 : 500;
}
