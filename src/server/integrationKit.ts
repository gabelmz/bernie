/**
 * Shared plumbing for the integration routes: config resolution with env
 * fallbacks, credential gating, response reading, and a fetch wrapper that
 * reports unreachable hosts usefully.
 */

import type express from "express";
import { GoogleGenAI } from "@google/genai";
import { GeminiConfig, IntegrationId, validateIntegrationConfig } from "../lib/integrationCore";
import { envConfig, mergedConfig } from "./runtime";

// Moved to runtime.ts so the Cloudflare Worker can use them without pulling in
// express or the Gemini SDK. Re-exported here so existing importers are
// unaffected by where they now live.
export { ambientEnv, envConfig, errorStatus, mergedConfig, probe, readJsonResponse } from "./runtime";

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
