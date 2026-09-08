import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import {
  AsanaConfig,
  IntegrationId,
  KeepaConfig,
  SheetsConfig,
  SupabaseConfig,
  buildAsanaTasksUrl,
  buildKeepaProductUrl,
  buildSheetValues,
  buildSheetsRequest,
  buildSupabaseRequest,
  normalizeAsanaTasks,
  normalizeKeepaProducts,
  parseAsinList,
  resolveConfig,
  summarizeRows,
  toRows,
  validateIntegrationConfig,
} from "./src/lib/integrationCore";

const app = express();
const PORT = 3000;

const AI_MODEL = "gemini-3.1-pro-preview";

app.use(cors());
// Keepa batches and Asana pages can be large, so allow generous JSON bodies.
app.use(express.json({ limit: "25mb" }));

// Initialize Gemini API
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  console.warn("Failed to initialize Gemini API", error);
}

// API Routes
app.post("/api/ai/execute", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { prompt, inputData } = req.body;
    
    const finalPrompt = `
      Instructions: ${prompt}
      
      Input Data:
      ${typeof inputData === 'object' ? JSON.stringify(inputData, null, 2) : inputData}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: finalPrompt,
    });

    res.json({ result: response.text });
  } catch (error) {
    console.error("AI execution error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});

app.post("/api/ai/suggest", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { nodes, edges } = req.body;
    
    const prompt = `
      You are an AI assistant in a visual node-based workflow builder (similar to Google Labs Stitch).
      The user has built the following workflow graph:
      Nodes: ${JSON.stringify(nodes, null, 2)}
      Edges: ${JSON.stringify(edges, null, 2)}
      
      Suggest 1-3 specific areas for automation or improvement. Provide the result as a JSON object:
      {
        "suggestions": [
          { "title": "...", "description": "..." }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("AI suggestion error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

app.post("/api/ai/parse-request", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }
  try {
    const { snippet } = req.body;
    
    const prompt = `
      You are an AI assistant that parses HTTP request snippets (cURL, JavaScript fetch, Python requests, OpenAPI spec, etc.).
      Extract the HTTP method, URL, headers, and body from the following snippet.
      
      Snippet:
      ${snippet}
      
      Return a JSON object with the following schema:
      {
        "method": "GET | POST | PUT | DELETE | PATCH | etc",
        "url": "https://...",
        "headers": { "Key": "Value" },
        "body": "stringified body or null"
      }
      Do not include any markdown formatting or extra text, just return the JSON object.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (error) {
    console.error("AI parse error:", error);
    res.status(500).json({ error: "Failed to parse snippet" });
  }
});

// Proxy HTTP requests for HTTP nodes to bypass CORS
app.post("/api/proxy", async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;
    const isGetOrHead = method === 'GET' || method === 'HEAD' || !method;
    
    let parsedBody = undefined;
    if (!isGetOrHead && body) {
      parsedBody = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    const response = await fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: parsedBody,
    });
    const text = await response.text();
    let data = text;
    try { data = JSON.parse(text); } catch(e) {}
    res.json({ status: response.status, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* Integrations: Asana, Keepa, Supabase, Google Sheets                        */
/* -------------------------------------------------------------------------- */

/**
 * Server-side defaults for each integration. Request configs (sent from the
 * Integrations page) take precedence, so env vars only act as a fallback for
 * headless / deployed runs.
 */
function envConfig(id: IntegrationId): Record<string, any> {
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
    default:
      return {};
  }
}

function mergedConfig<T extends Record<string, any>>(id: IntegrationId, requestConfig: any): T {
  return resolveConfig(envConfig(id) as T, (requestConfig || {}) as Partial<T>);
}

/** Rejects the request when required credentials are still missing. */
function assertConfigured(id: IntegrationId, config: Record<string, any>, res: express.Response): boolean {
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

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorStatus(err: any): number {
  // Config problems surfaced by the builders are the caller's fault.
  return /required|provide at least|set a project|no rows/i.test(String(err?.message)) ? 400 : 500;
}

app.post("/api/asana/tasks", async (req, res) => {
  const config = mergedConfig<AsanaConfig>("asana", req.body?.config);
  if (!assertConfigured("asana", config, res)) return;

  try {
    const url = buildAsanaTasksUrl(config);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${String(config.accessToken).trim()}`,
        Accept: "application/json",
      },
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const detail = payload?.errors?.[0]?.message || payload?.message;
      return res.status(response.status).json({
        error: detail ? `Asana: ${detail}` : `Asana request failed (${response.status}).`,
      });
    }

    const rows = normalizeAsanaTasks(payload?.data);
    res.json({
      source: "asana",
      rows,
      count: rows.length,
      projectGid: config.projectGid || null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Asana fetch error:", err);
    res.status(errorStatus(err)).json({ error: err?.message || "Failed to pull Asana tasks." });
  }
});

app.post("/api/keepa/products", async (req, res) => {
  const config = mergedConfig<KeepaConfig>("keepa", req.body?.config);
  if (!assertConfigured("keepa", config, res)) return;

  try {
    const asins = parseAsinList(req.body?.asins ?? config.asins);
    const url = buildKeepaProductUrl(config, asins);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await readJsonResponse(response);

    if (!response.ok || payload?.error) {
      const detail = payload?.error?.message || payload?.error || payload?.message;
      return res.status(response.ok ? 400 : response.status).json({
        error: detail ? `Keepa: ${detail}` : `Keepa request failed (${response.status}).`,
      });
    }

    const rows = normalizeKeepaProducts(payload?.products);
    res.json({
      source: "keepa",
      rows,
      count: rows.length,
      requestedAsins: asins,
      tokensLeft: payload?.tokensLeft ?? null,
      refillIn: payload?.refillIn ?? null,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Keepa fetch error:", err);
    res.status(errorStatus(err)).json({ error: err?.message || "Failed to pull Keepa product data." });
  }
});

app.post("/api/supabase/rows", async (req, res) => {
  const config = mergedConfig<SupabaseConfig>("supabase", req.body?.config);
  if (!assertConfigured("supabase", config, res)) return;

  try {
    const rows = toRows(req.body?.rows ?? req.body?.input);
    const request = buildSupabaseRequest(config, rows);

    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const detail = payload?.message || payload?.error || payload?.hint;
      return res.status(response.status).json({
        error: detail ? `Supabase: ${detail}` : `Supabase write failed (${response.status}).`,
        details: payload?.details ?? null,
      });
    }

    const written = Array.isArray(payload) ? payload.length : rows.length;
    res.json({
      source: "supabase",
      success: true,
      table: config.table,
      mode: config.mode === "upsert" ? "upsert" : "insert",
      written,
      rows: Array.isArray(payload) ? payload : [],
      writtenAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Supabase write error:", err);
    res.status(errorStatus(err)).json({ error: err?.message || "Failed to write rows to Supabase." });
  }
});

app.post("/api/sheets/rows", async (req, res) => {
  const config = mergedConfig<SheetsConfig>("sheets", req.body?.config);
  if (!assertConfigured("sheets", config, res)) return;

  const accessToken = String(req.body?.accessToken || config.accessToken || "").trim();
  if (!accessToken) {
    return res.status(401).json({
      error: "Google Sheets: connect a Google account in Integrations, or set an access token override.",
    });
  }

  try {
    const rows = toRows(req.body?.rows ?? req.body?.input);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Google Sheets: no rows to write." });
    }

    const values = buildSheetValues(rows, config.includeHeaders !== false);
    const request = buildSheetsRequest(config, values);

    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.body),
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message;
      return res.status(response.status).json({
        error: detail ? `Google Sheets: ${detail}` : `Google Sheets write failed (${response.status}).`,
      });
    }

    res.json({
      source: "sheets",
      success: true,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName || "Sheet1",
      mode: config.mode === "overwrite" ? "overwrite" : "append",
      written: rows.length,
      updatedRange: payload?.updates?.updatedRange ?? payload?.updatedRange ?? null,
      updatedRows: payload?.updates?.updatedRows ?? payload?.updatedRows ?? null,
      writtenAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Sheets write error:", err);
    res.status(errorStatus(err)).json({ error: err?.message || "Failed to write rows to Google Sheets." });
  }
});

app.post("/api/ai/insights", async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini API key not configured." });
  }

  try {
    const rows = toRows(req.body?.rows ?? req.body?.input);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Insights: connect a node that produces rows first." });
    }

    const summary = summarizeRows(rows);
    const sampleSize = Math.min(Number(req.body?.sampleSize) || 40, 200);
    const focus = String(req.body?.focus || "").trim();

    const prompt = `
      You are a data analyst embedded in a workflow automation canvas.
      Analyse the dataset below and report what matters, grounded strictly in the data provided.

      ${focus ? `Analysis focus from the user: ${focus}` : "No specific focus was given; report the most decision-relevant findings."}

      Dataset shape:
      ${JSON.stringify(summary, null, 2)}

      Sample rows (first ${Math.min(sampleSize, rows.length)} of ${rows.length}):
      ${JSON.stringify(rows.slice(0, sampleSize), null, 2)}

      Return only a JSON object with this schema:
      {
        "headline": "one sentence takeaway",
        "summary": "2-4 sentence plain-language summary",
        "keyFindings": [{ "title": "...", "detail": "...", "impact": "high | medium | low" }],
        "anomalies": [{ "title": "...", "detail": "...", "severity": "high | medium | low" }],
        "recommendations": [{ "action": "...", "rationale": "...", "priority": "high | medium | low" }]
      }
      Use an empty array when a section has nothing worth reporting. Never invent fields or values that are not in the data.
    `;

    const response = await ai.models.generateContent({
      model: String(req.body?.model || AI_MODEL),
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let insights: any;
    try {
      insights = JSON.parse(response.text || "{}");
    } catch {
      return res.status(502).json({ error: "Insights: the model returned a response that was not valid JSON." });
    }

    res.json({
      source: "insights",
      insights,
      rowCount: summary.rowCount,
      fields: summary.fields,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI insights error:", error);
    res.status(500).json({ error: error?.message || "Failed to generate insights." });
  }
});

/** Credential smoke test used by the Integrations page. */
app.post("/api/integrations/test", async (req, res) => {
  const id = String(req.body?.id || "") as IntegrationId;
  if (!["asana", "keepa", "supabase", "sheets"].includes(id)) {
    return res.status(400).json({ error: `Unknown integration "${id}".` });
  }

  const config = mergedConfig<Record<string, any>>(id, req.body?.config);
  if (!assertConfigured(id, config, res)) return;

  try {
    if (id === "asana") {
      const response = await fetch("https://app.asana.com/api/1.0/users/me?opt_fields=name,email", {
        headers: { Authorization: `Bearer ${String(config.accessToken).trim()}` },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        const detail = payload?.errors?.[0]?.message;
        return res.status(response.status).json({ error: detail ? `Asana: ${detail}` : "Asana token rejected." });
      }
      return res.json({ ok: true, detail: `Connected as ${payload?.data?.name || "Asana user"}.` });
    }

    if (id === "keepa") {
      const response = await fetch(`https://api.keepa.com/token?key=${encodeURIComponent(String(config.apiKey).trim())}`);
      const payload = await readJsonResponse(response);
      if (!response.ok || payload?.error) {
        return res.status(response.ok ? 400 : response.status).json({ error: "Keepa: API key rejected." });
      }
      return res.json({ ok: true, detail: `${payload?.tokensLeft ?? 0} tokens left.` });
    }

    if (id === "supabase") {
      const base = String(config.url).trim().replace(/\/+$/, "");
      const table = String(config.table || "").trim();
      const apiKey = String(config.apiKey).trim();
      const url = table
        ? `${base}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`
        : `${base}/rest/v1/`;
      const response = await fetch(url, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const payload = await readJsonResponse(response);
        const detail = payload?.message || payload?.hint;
        return res.status(response.status).json({
          error: detail ? `Supabase: ${detail}` : `Supabase rejected the request (${response.status}).`,
        });
      }
      return res.json({ ok: true, detail: table ? `Table "${table}" is reachable.` : "Project REST API is reachable." });
    }

    // sheets
    const accessToken = String(req.body?.accessToken || config.accessToken || "").trim();
    if (!accessToken) {
      return res.status(401).json({ error: "Google Sheets: connect a Google account first." });
    }
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(String(config.spreadsheetId).trim())}?fields=properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const detail = payload?.error?.message;
      return res.status(response.status).json({ error: detail ? `Google Sheets: ${detail}` : "Spreadsheet not reachable." });
    }
    return res.json({ ok: true, detail: `Opened "${payload?.properties?.title || "spreadsheet"}".` });
  } catch (err: any) {
    console.error(`Integration test failed for ${id}:`, err);
    res.status(500).json({ error: err?.message || "Connection test failed." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
