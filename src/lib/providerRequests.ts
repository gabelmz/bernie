/**
 * Per-provider request builders and response normalizers. Pure and
 * dependency-free like `integrationCore`, so the Express server and the React
 * nodes construct byte-identical requests and both are unit testable.
 */

import {
  AsanaConfig,
  HuggingFaceConfig,
  KeepaConfig,
  McpConfig,
  OpenRouterConfig,
  OpencodeConfig,
  SheetsConfig,
  SupabaseConfig,
} from './integrationCore';

export interface SheetsWriteRequest {
  url: string;
  method: 'POST' | 'PUT';
  body: { range: string; majorDimension: 'ROWS'; values: any[][] };
}

/**
 * Builds the Sheets REST call for either append or overwrite mode.
 */
export function buildSheetsRequest(config: SheetsConfig, values: any[][]): SheetsWriteRequest {
  const spreadsheetId = String(config.spreadsheetId || '').trim();
  if (!spreadsheetId) throw new Error('Google Sheets: a spreadsheet ID is required.');

  const sheetName = String(config.sheetName || 'Sheet1').trim() || 'Sheet1';
  const range = `${sheetName}!A1`;
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;

  if (config.mode === 'overwrite') {
    return {
      url: `${base}?valueInputOption=USER_ENTERED`,
      method: 'PUT',
      body: { range, majorDimension: 'ROWS', values },
    };
  }

  return {
    url: `${base}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    method: 'POST',
    body: { range, majorDimension: 'ROWS', values },
  };
}

export interface SupabaseRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>[];
}

/**
 * Builds the Supabase REST insert/upsert call for a batch of rows.
 */
export function buildSupabaseRequest(config: SupabaseConfig, rows: Record<string, any>[]): SupabaseRequest {
  const baseUrl = String(config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('Supabase: a project URL is required.');

  const apiKey = String(config.apiKey || '').trim();
  if (!apiKey) throw new Error('Supabase: an API key is required.');

  const table = String(config.table || '').trim();
  if (!table) throw new Error('Supabase: a target table is required.');

  if (rows.length === 0) throw new Error('Supabase: no rows to write.');

  const mode = config.mode === 'upsert' ? 'upsert' : 'insert';
  const onConflict = String(config.onConflict || '').trim();

  let url = `${baseUrl}/rest/v1/${encodeURIComponent(table)}`;
  if (mode === 'upsert' && onConflict) {
    url += `?on_conflict=${encodeURIComponent(onConflict)}`;
  }

  const prefer = ['return=representation'];
  if (mode === 'upsert') prefer.push('resolution=merge-duplicates');

  return {
    url,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: prefer.join(','),
    },
    body: rows,
  };
}

export const ASANA_OPT_FIELDS = [
  'gid',
  'name',
  'completed',
  'completed_at',
  'due_on',
  'due_at',
  'start_on',
  'notes',
  'permalink_url',
  'created_at',
  'modified_at',
  'num_subtasks',
  'assignee.gid',
  'assignee.name',
  'projects.gid',
  'projects.name',
  'tags.name',
  'custom_fields.name',
  'custom_fields.display_value',
].join(',');

/**
 * Builds the Asana `GET /tasks` URL. Asana requires either a project or an
 * assignee scoped to a workspace, so this throws when neither is configured.
 */
export function buildAsanaTasksUrl(config: AsanaConfig): string {
  const params = new URLSearchParams();
  const projectGid = String(config.projectGid || '').trim();
  const workspaceGid = String(config.workspaceGid || '').trim();
  const assigneeGid = String(config.assigneeGid || '').trim();

  if (projectGid) {
    params.set('project', projectGid);
  } else if (assigneeGid && workspaceGid) {
    params.set('assignee', assigneeGid);
    params.set('workspace', workspaceGid);
  } else {
    throw new Error('Asana: set a project GID, or an assignee GID together with a workspace GID.');
  }

  if (!config.includeCompleted) {
    // `now` asks Asana for tasks that are incomplete or completed after this instant.
    params.set('completed_since', 'now');
  }

  const limit = Number(config.limit);
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.min(Math.trunc(limit), 100)));
  }

  params.set('opt_fields', ASANA_OPT_FIELDS);
  return `https://app.asana.com/api/1.0/tasks?${params.toString()}`;
}

/**
 * Flattens Asana's nested task objects into spreadsheet-friendly rows.
 */
export function normalizeAsanaTasks(tasks: any[]): Record<string, any>[] {
  if (!Array.isArray(tasks)) return [];

  return tasks.map((task) => {
    const row: Record<string, any> = {
      gid: task?.gid ?? null,
      name: task?.name ?? null,
      completed: Boolean(task?.completed),
      completed_at: task?.completed_at ?? null,
      due_on: task?.due_on ?? null,
      due_at: task?.due_at ?? null,
      start_on: task?.start_on ?? null,
      assignee: task?.assignee?.name ?? null,
      assignee_gid: task?.assignee?.gid ?? null,
      projects: Array.isArray(task?.projects) ? task.projects.map((p: any) => p?.name).filter(Boolean).join(', ') : null,
      tags: Array.isArray(task?.tags) ? task.tags.map((t: any) => t?.name).filter(Boolean).join(', ') : null,
      num_subtasks: task?.num_subtasks ?? 0,
      notes: task?.notes ?? null,
      permalink_url: task?.permalink_url ?? null,
      created_at: task?.created_at ?? null,
      modified_at: task?.modified_at ?? null,
    };

    if (Array.isArray(task?.custom_fields)) {
      task.custom_fields.forEach((field: any) => {
        const name = field?.name;
        if (typeof name === 'string' && name.trim()) {
          row[`cf_${name.trim().toLowerCase().replace(/\s+/g, '_')}`] = field?.display_value ?? null;
        }
      });
    }

    return row;
  });
}

/** Parses a comma / newline / whitespace separated ASIN list. */
export function parseAsinList(raw: string | string[] | undefined | null): string[] {
  if (Array.isArray(raw)) {
    return raw.map((a) => String(a).trim().toUpperCase()).filter(Boolean);
  }
  if (!raw) return [];
  return String(raw)
    .split(/[\s,;]+/)
    .map((a) => a.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Coerces a Keepa field to a usable number, or null. Missing values must not
 * become 0 (`Number(null)` is 0), because a 0 would be written downstream as a
 * real price or rank. Keepa itself uses -1 for "no data".
 */
function keepaNumber(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

/**
 * Keepa reports prices as integers in the marketplace's minor unit and uses
 * -1 for "no data". Sales ranks and review counts share the same -1 sentinel
 * but must not be divided.
 */
export function decodeKeepaPrice(value: any): number | null {
  const num = keepaNumber(value);
  return num === null ? null : Math.round(num) / 100;
}

export function decodeKeepaInt(value: any): number | null {
  const num = keepaNumber(value);
  return num === null ? null : Math.trunc(num);
}

/** Keepa ratings are stored as the rating times ten (45 => 4.5). */
export function decodeKeepaRating(value: any): number | null {
  const num = keepaNumber(value);
  return num === null ? null : Math.round(num) / 10;
}

/** Keepa minutes are offset from 2011-01-01T00:00:00Z (21564000 minutes). */
export function keepaMinutesToIso(minutes: any): string | null {
  const num = keepaNumber(minutes);
  if (num === null || num <= 0) return null;
  return new Date((num + 21564000) * 60000).toISOString();
}

export const KEEPA_CSV_INDEX = {
  AMAZON: 0,
  NEW: 1,
  USED: 2,
  SALES_RANK: 3,
  LIST_PRICE: 4,
  RATING: 16,
  REVIEW_COUNT: 17,
  BUY_BOX: 18,
} as const;

/** Reads the newest value out of a Keepa `csv` history track. */
export function lastKeepaCsvValue(csv: any, index: number): number | null {
  if (!Array.isArray(csv)) return null;
  const track = csv[index];
  if (!Array.isArray(track) || track.length < 2) return null;
  // Tracks are [time, value, time, value, ...], so the newest value is last.
  const value = Number(track[track.length - 1]);
  return Number.isFinite(value) ? value : null;
}

function currentKeepaValue(product: any, index: number): number | null {
  const stats = product?.stats;
  if (stats && Array.isArray(stats.current) && stats.current.length > index) {
    const value = Number(stats.current[index]);
    if (Number.isFinite(value)) return value;
  }
  return lastKeepaCsvValue(product?.csv, index);
}

/**
 * Flattens Keepa product objects into rows with decoded prices and ranks.
 */
export function normalizeKeepaProducts(products: any[]): Record<string, any>[] {
  if (!Array.isArray(products)) return [];

  return products.map((product) => ({
    asin: product?.asin ?? null,
    title: product?.title ?? null,
    brand: product?.brand ?? null,
    manufacturer: product?.manufacturer ?? null,
    product_group: product?.productGroup ?? null,
    root_category: product?.rootCategory ?? null,
    domain_id: product?.domainId ?? null,
    amazon_price: decodeKeepaPrice(currentKeepaValue(product, KEEPA_CSV_INDEX.AMAZON)),
    new_price: decodeKeepaPrice(currentKeepaValue(product, KEEPA_CSV_INDEX.NEW)),
    used_price: decodeKeepaPrice(currentKeepaValue(product, KEEPA_CSV_INDEX.USED)),
    buy_box_price: decodeKeepaPrice(currentKeepaValue(product, KEEPA_CSV_INDEX.BUY_BOX)),
    list_price: decodeKeepaPrice(currentKeepaValue(product, KEEPA_CSV_INDEX.LIST_PRICE)),
    sales_rank: decodeKeepaInt(currentKeepaValue(product, KEEPA_CSV_INDEX.SALES_RANK)),
    rating: decodeKeepaRating(currentKeepaValue(product, KEEPA_CSV_INDEX.RATING)),
    review_count: decodeKeepaInt(currentKeepaValue(product, KEEPA_CSV_INDEX.REVIEW_COUNT)),
    package_weight_g: decodeKeepaInt(product?.packageWeight),
    last_update: keepaMinutesToIso(product?.lastUpdate),
  }));
}

/**
 * Builds the Keepa `/product` URL for a batch of ASINs (Keepa caps a single
 * request at 100 ASINs).
 */
export function buildKeepaProductUrl(config: KeepaConfig, asins: string[]): string {
  const apiKey = String(config.apiKey || '').trim();
  if (!apiKey) throw new Error('Keepa: an API key is required.');
  if (asins.length === 0) throw new Error('Keepa: provide at least one ASIN.');

  const params = new URLSearchParams();
  params.set('key', apiKey);
  params.set('domain', String(Number(config.domain) > 0 ? Number(config.domain) : 1));
  params.set('asin', asins.slice(0, 100).join(','));

  const statsDays = Number(config.statsDays);
  if (Number.isFinite(statsDays) && statsDays > 0) {
    params.set('stats', String(Math.trunc(statsDays)));
  }

  return `https://api.keepa.com/product?${params.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* Chat-style AI providers                                                    */
/* -------------------------------------------------------------------------- */

export interface ChatRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

/**
 * Renders a prompt plus the rows arriving on a node's input into a single user
 * message. Rows are truncated so a large batch cannot blow the context window.
 */
export function buildChatPrompt(prompt: string, rows: Record<string, any>[], sampleSize = 40): string {
  const instruction = String(prompt || '').trim() || 'Summarize the input data.';
  if (rows.length === 0) return instruction;

  const sample = rows.slice(0, Math.max(1, sampleSize));
  const omitted = rows.length - sample.length;
  const note = omitted > 0 ? `\n(${omitted} further rows omitted.)` : '';

  return `${instruction}\n\nInput data (${rows.length} row${rows.length === 1 ? '' : 's'}):\n${JSON.stringify(sample, null, 2)}${note}`;
}

/** Builds the OpenRouter chat-completions call. */
export function buildOpenRouterRequest(
  config: OpenRouterConfig,
  content: string,
  options: { model?: string; systemPrompt?: string } = {}
): ChatRequest {
  const apiKey = String(config.apiKey || '').trim();
  if (!apiKey) throw new Error('OpenRouter: an API key is required.');

  const model = String(options.model || config.model || '').trim();
  if (!model) throw new Error('OpenRouter: choose a model, e.g. anthropic/claude-sonnet-4.5.');

  const base = String(config.baseUrl || 'https://openrouter.ai/api/v1').trim().replace(/\/+$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const appName = String(config.appName || '').trim();
  if (appName) headers['X-Title'] = appName;

  const messages: { role: string; content: string }[] = [];
  const systemPrompt = String(options.systemPrompt || '').trim();
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content });

  return { url: `${base}/chat/completions`, headers, body: { model, messages } };
}

/**
 * Builds the Hugging Face call. A dedicated endpoint URL is used verbatim;
 * otherwise the request goes to the router's OpenAI-compatible surface.
 */
export function buildHuggingFaceRequest(
  config: HuggingFaceConfig,
  content: string,
  options: { model?: string } = {}
): ChatRequest {
  const token = String(config.token || '').trim();
  if (!token) throw new Error('Hugging Face: an access token is required.');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const endpointUrl = String(config.endpointUrl || '').trim().replace(/\/+$/, '');
  if (endpointUrl) {
    // Dedicated endpoints take the plain inference payload.
    return { url: endpointUrl, headers, body: { inputs: content } };
  }

  const model = String(options.model || config.model || '').trim();
  if (!model) throw new Error('Hugging Face: choose a model, or set a dedicated endpoint URL.');

  return {
    url: 'https://router.huggingface.co/v1/chat/completions',
    headers,
    body: { model, messages: [{ role: 'user', content }] },
  };
}

/**
 * Pulls the assistant text out of an OpenAI-shaped chat completion, a Hugging
 * Face inference array, or a dedicated endpoint's object response.
 */
export function extractCompletionText(payload: any): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') return payload;

  const choice = payload?.choices?.[0];
  if (choice) {
    const content = choice?.message?.content ?? choice?.text;
    if (typeof content === 'string') return content;
    // Some providers return content as an array of typed parts.
    if (Array.isArray(content)) {
      const joined = content
        .map((part: any) => (typeof part === 'string' ? part : part?.text))
        .filter((text: any) => typeof text === 'string')
        .join('');
      if (joined) return joined;
    }
  }

  if (Array.isArray(payload)) {
    const first = payload[0];
    if (typeof first === 'string') return first;
    const text = first?.generated_text ?? first?.summary_text ?? first?.translation_text;
    if (typeof text === 'string') return text;
  }

  if (typeof payload?.generated_text === 'string') return payload.generated_text;

  return null;
}

/* -------------------------------------------------------------------------- */
/* opencode                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Splits an opencode model id into the provider / model pair its API expects
 * ("anthropic/claude-sonnet-4.5" -> providerID "anthropic").
 */
export function splitOpencodeModel(model: string | undefined): { providerID: string; modelID: string } | null {
  const raw = String(model || '').trim();
  if (!raw) return null;

  const slash = raw.indexOf('/');
  if (slash <= 0 || slash === raw.length - 1) return null;

  return { providerID: raw.slice(0, slash), modelID: raw.slice(slash + 1) };
}

export interface OpencodeRequest {
  sessionUrl: string;
  messageUrl: (sessionId: string) => string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

/** Builds the two calls needed to prompt an opencode session. */
export function buildOpencodeRequest(
  config: OpencodeConfig,
  content: string,
  options: { model?: string } = {}
): OpencodeRequest {
  const base = String(config.baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('opencode: a server URL is required.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = String(config.apiKey || '').trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body: Record<string, any> = { parts: [{ type: 'text', text: content }] };
  const model = splitOpencodeModel(options.model || config.model);
  if (model) body.model = model;

  return {
    sessionUrl: `${base}/session`,
    messageUrl: (sessionId: string) => `${base}/session/${encodeURIComponent(sessionId)}/message`,
    headers,
    body,
  };
}

/** Collects the text parts out of an opencode message response. */
export function extractOpencodeText(payload: any): string | null {
  const parts = payload?.parts ?? payload?.message?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
      .map((part: any) => part.text)
      .join('\n')
      .trim();
    if (text) return text;
  }

  if (typeof payload?.text === 'string') return payload.text;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Model Context Protocol (Streamable HTTP transport)                         */
/* -------------------------------------------------------------------------- */

export const MCP_PROTOCOL_VERSION = '2025-06-18';

export interface McpRpcRequest {
  url: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

/**
 * Builds one JSON-RPC 2.0 call against an MCP server's Streamable HTTP
 * endpoint. Only http/https URLs work: the ws and sse transports need a
 * persistent connection this proxy does not hold open.
 */
export function buildMcpRequest(
  config: McpConfig,
  method: string,
  params: Record<string, any> | undefined,
  id: number | string,
  sessionId?: string
): McpRpcRequest {
  const url = String(config.serverUrl || '').trim();
  if (!url) throw new Error('MCP: a server URL is required.');
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `MCP: only http(s) endpoints are supported, got "${url}". The websocket and SSE transports are not implemented.`
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Streamable HTTP servers may answer with either JSON or an SSE stream.
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const body: Record<string, any> = { jsonrpc: '2.0', id, method };
  if (params !== undefined) body.params = params;

  return { url, headers, body };
}

/** The `initialize` params an MCP server expects from a new client. */
export function mcpInitializeParams(): Record<string, any> {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'bernie-workflow-canvas', version: '1.0.0' },
  };
}

/**
 * Parses an MCP Streamable HTTP response body, which is either a JSON-RPC
 * object or an SSE stream whose `data:` lines carry them.
 */
export function parseMcpResponseBody(text: string): any {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('event:') && !trimmed.startsWith('data:')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  // Walk the SSE frames and return the last JSON-RPC payload found.
  let last: any = null;
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const chunk = line.slice(5).trim();
    if (!chunk || chunk === '[DONE]') continue;
    try {
      last = JSON.parse(chunk);
    } catch {
      // A partial frame is skipped rather than failing the whole read.
    }
  }
  return last;
}

/** Flattens MCP `tools/list` output into rows for the node table. */
export function normalizeMcpTools(payload: any): Record<string, any>[] {
  const tools = payload?.result?.tools ?? payload?.tools;
  if (!Array.isArray(tools)) return [];

  return tools.map((tool: any) => ({
    name: tool?.name ?? null,
    description: tool?.title || tool?.description || null,
    required: Array.isArray(tool?.inputSchema?.required) ? tool.inputSchema.required.join(', ') : null,
    properties: tool?.inputSchema?.properties ? Object.keys(tool.inputSchema.properties).join(', ') : null,
  }));
}

/** Reduces an MCP `tools/call` result to text plus any structured content. */
export function extractMcpCallResult(payload: any): { text: string | null; structured: any } {
  const result = payload?.result;
  const content = result?.content;

  let text: string | null = null;
  if (Array.isArray(content)) {
    const joined = content
      .filter((item: any) => item?.type === 'text' && typeof item?.text === 'string')
      .map((item: any) => item.text)
      .join('\n')
      .trim();
    if (joined) text = joined;
  }

  return { text, structured: result?.structuredContent ?? null };
}
