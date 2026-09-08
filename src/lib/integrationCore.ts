/**
 * Pure, dependency-free integration logic shared by the Express server and the
 * React nodes. Nothing in here may touch the DOM, React, or Node built-ins so
 * that it can be bundled into `dist/server.cjs` and unit tested in isolation.
 */

export type IntegrationId =
  | 'asana'
  | 'keepa'
  | 'supabase'
  | 'sheets'
  | 'drive'
  | 'gemini'
  | 'openrouter'
  | 'huggingface'
  | 'opencode'
  | 'github'
  | 'http'
  | 'mcp';

export const INTEGRATION_IDS: IntegrationId[] = [
  'asana',
  'keepa',
  'drive',
  'supabase',
  'sheets',
  'gemini',
  'openrouter',
  'huggingface',
  'opencode',
  'github',
  'http',
  'mcp',
];

/** Groups used to lay the integrations out on the Connections page. */
export type IntegrationCategory = 'sources' | 'destinations' | 'ai' | 'developer';

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory; title: string; blurb: string }[] = [
  { id: 'sources', title: 'Data Sources', blurb: 'Pull rows into a workflow.' },
  { id: 'destinations', title: 'Destinations', blurb: 'Write rows out of a workflow.' },
  { id: 'ai', title: 'AI Providers', blurb: 'Models used by the AI and Insights nodes.' },
  { id: 'developer', title: 'Developer Tools', blurb: 'Endpoints and tokens reused across nodes.' },
];

export interface AsanaConfig {
  accessToken?: string;
  workspaceGid?: string;
  projectGid?: string;
  assigneeGid?: string;
  includeCompleted?: boolean;
  limit?: number;
}

export interface KeepaConfig {
  apiKey?: string;
  domain?: number;
  asins?: string;
  statsDays?: number;
}

export interface SupabaseConfig {
  url?: string;
  apiKey?: string;
  /** Anon / publishable key, used by browser sign-in. Never the service role. */
  anonKey?: string;
  table?: string;
  mode?: 'insert' | 'upsert';
  onConflict?: string;
}

export interface SheetsConfig {
  spreadsheetId?: string;
  sheetName?: string;
  mode?: 'append' | 'overwrite';
  includeHeaders?: boolean;
  accessToken?: string;
}

export interface DriveConfig {
  folderId?: string;
  folderName?: string;
  accessToken?: string;
}

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
}

export interface OpenRouterConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  appName?: string;
}

export interface HuggingFaceConfig {
  token?: string;
  model?: string;
  endpointUrl?: string;
}

export interface OpencodeConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface GithubConfig {
  token?: string;
  owner?: string;
  repo?: string;
  apiBaseUrl?: string;
}

/** Saved defaults reused by HTTP nodes ("custom HTTP saves"). */
export interface HttpConfig {
  baseUrl?: string;
  headers?: string;
  authHeader?: string;
  timeoutMs?: number;
}

export interface McpConfig {
  serverUrl?: string;
}

export interface IntegrationConfigMap {
  asana: AsanaConfig;
  keepa: KeepaConfig;
  supabase: SupabaseConfig;
  sheets: SheetsConfig;
  drive: DriveConfig;
  gemini: GeminiConfig;
  openrouter: OpenRouterConfig;
  huggingface: HuggingFaceConfig;
  opencode: OpencodeConfig;
  github: GithubConfig;
  http: HttpConfig;
  mcp: McpConfig;
}

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
}

export interface IntegrationSchema {
  id: IntegrationId;
  name: string;
  description: string;
  category: IntegrationCategory;
  /** Fields that must be present before any node of this kind can run. */
  requiredKeys: string[];
  fields: IntegrationField[];
  /**
   * False when there is no endpoint we can meaningfully probe, so the UI hides
   * the Test Connection button rather than faking a result.
   */
  testable?: boolean;
  /** Authorizes with the connected Google account instead of a stored key. */
  requiresGoogleAuth?: boolean;
  /** Set when the credentials are stored but no node consumes them yet. */
  configOnlyNote?: string;
}

/** Keepa marketplace ids, see https://keepa.com/#!discuss/t/product-object/116 */
export const KEEPA_DOMAINS: { value: number; label: string }[] = [
  { value: 1, label: 'amazon.com (US)' },
  { value: 2, label: 'amazon.co.uk (UK)' },
  { value: 3, label: 'amazon.de (DE)' },
  { value: 4, label: 'amazon.fr (FR)' },
  { value: 5, label: 'amazon.co.jp (JP)' },
  { value: 6, label: 'amazon.ca (CA)' },
  { value: 8, label: 'amazon.it (IT)' },
  { value: 9, label: 'amazon.es (ES)' },
  { value: 10, label: 'amazon.in (IN)' },
  { value: 11, label: 'amazon.com.mx (MX)' },
];

export const INTEGRATION_SCHEMAS: Record<IntegrationId, IntegrationSchema> = {
  asana: {
    id: 'asana',
    name: 'Asana',
    description: 'Pull tasks from a project or an assignee task list.',
    category: 'sources',
    testable: true,
    requiredKeys: ['accessToken'],
    fields: [
      { key: 'accessToken', label: 'Personal Access Token', type: 'password', required: true, placeholder: '1/1234567890:abcdef...', help: 'Asana profile settings, Apps, Manage Developer Apps.' },
      { key: 'workspaceGid', label: 'Default Workspace GID', type: 'text', placeholder: '1200000000000000' },
      { key: 'projectGid', label: 'Default Project GID', type: 'text', placeholder: '1200000000000001', help: 'Used when a node does not set its own project.' },
      { key: 'assigneeGid', label: 'Default Assignee GID', type: 'text', placeholder: 'me' },
      { key: 'includeCompleted', label: 'Include completed tasks', type: 'checkbox' },
      { key: 'limit', label: 'Page size', type: 'number', placeholder: '100' },
    ],
  },
  keepa: {
    id: 'keepa',
    name: 'Keepa',
    description: 'Pull Amazon product data, pricing and sales rank by ASIN.',
    category: 'sources',
    testable: true,
    requiredKeys: ['apiKey'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Keepa API key', help: 'keepa.com, API access.' },
      { key: 'domain', label: 'Marketplace', type: 'select', options: KEEPA_DOMAINS },
      { key: 'asins', label: 'Default ASINs', type: 'textarea', placeholder: 'B0011,B0022 (comma or newline separated)' },
      { key: 'statsDays', label: 'Stats window (days)', type: 'number', placeholder: '30' },
    ],
  },
  supabase: {
    id: 'supabase',
    name: 'Supabase',
    description: 'Push rows into Postgres, and sign in with Google.',
    category: 'destinations',
    testable: true,
    requiredKeys: ['url', 'apiKey'],
    fields: [
      { key: 'url', label: 'Project URL', type: 'text', required: true, placeholder: 'https://xxxxx.supabase.co' },
      { key: 'apiKey', label: 'Service Role Key (server writes)', type: 'password', required: true, placeholder: 'eyJhbGciOi...', help: 'Used server-side by the Supabase node. Never sent to the browser by Bernie.' },
      { key: 'anonKey', label: 'Anon / Publishable Key (sign-in)', type: 'password', placeholder: 'eyJhbGciOi...', help: 'Safe for the browser. Required to sign out; sign-in also needs Google enabled under Authentication, Providers.' },
      { key: 'table', label: 'Default Table', type: 'text', placeholder: 'products' },
      { key: 'mode', label: 'Write Mode', type: 'select', options: [{ value: 'insert', label: 'Insert' }, { value: 'upsert', label: 'Upsert (merge duplicates)' }] },
      { key: 'onConflict', label: 'On Conflict Column(s)', type: 'text', placeholder: 'asin', help: 'Comma separated, required for upsert.' },
    ],
  },
  sheets: {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Push rows into a spreadsheet tab.',
    category: 'destinations',
    testable: true,
    requiresGoogleAuth: true,
    requiredKeys: ['spreadsheetId'],
    fields: [
      { key: 'spreadsheetId', label: 'Default Spreadsheet ID', type: 'text', required: true, placeholder: '1BxiMVs0XRY...', help: 'The long id in the sheet URL.' },
      { key: 'sheetName', label: 'Default Tab Name', type: 'text', placeholder: 'Sheet1' },
      { key: 'mode', label: 'Write Mode', type: 'select', options: [{ value: 'append', label: 'Append rows' }, { value: 'overwrite', label: 'Overwrite from A1' }] },
      { key: 'includeHeaders', label: 'Write a header row', type: 'checkbox' },
      { key: 'accessToken', label: 'OAuth Access Token Override', type: 'password', placeholder: 'ya29...', help: 'Optional. Leave blank to use the connected Google account.' },
    ],
  },
  drive: {
    id: 'drive',
    name: 'Google Drive',
    description: 'Read and write files, scoped to a default folder.',
    category: 'sources',
    testable: true,
    requiresGoogleAuth: true,
    requiredKeys: [],
    fields: [
      { key: 'folderId', label: 'Default Folder ID', type: 'text', placeholder: '1AbCdEfGhIjK...', help: 'The id in the folder URL. Leave blank for My Drive.' },
      { key: 'folderName', label: 'Folder Label', type: 'text', placeholder: 'Bernie exports', help: 'Shown on Drive nodes so you can tell folders apart.' },
      { key: 'accessToken', label: 'OAuth Access Token Override', type: 'password', placeholder: 'ya29...', help: 'Optional. Leave blank to use the connected Google account.' },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    description: 'Powers the AI Agent and AI Insights nodes.',
    category: 'ai',
    testable: true,
    requiredKeys: ['apiKey'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'AIza...', help: 'aistudio.google.com. Overrides the server GEMINI_API_KEY.' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'gemini-3.1-pro-preview' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'One key for many hosted models. Powers the OpenRouter node.',
    category: 'ai',
    testable: true,
    requiredKeys: ['apiKey'],
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-or-v1-...', help: 'openrouter.ai/keys.' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'anthropic/claude-sonnet-4.5' },
      { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://openrouter.ai/api/v1' },
      { key: 'appName', label: 'App Name (X-Title header)', type: 'text', placeholder: 'Bernie' },
    ],
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Inference API or a dedicated endpoint. Powers the Hugging Face node.',
    category: 'ai',
    testable: true,
    requiredKeys: ['token'],
    fields: [
      { key: 'token', label: 'Access Token', type: 'password', required: true, placeholder: 'hf_...', help: 'huggingface.co/settings/tokens.' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'meta-llama/Llama-3.3-70B-Instruct' },
      { key: 'endpointUrl', label: 'Dedicated Endpoint URL', type: 'text', placeholder: 'https://xxxx.endpoints.huggingface.cloud', help: 'Optional. Leave blank to use the shared Inference API.' },
    ],
  },
  opencode: {
    id: 'opencode',
    name: 'opencode',
    description: 'A local or remote opencode server. Powers the opencode node.',
    category: 'developer',
    testable: true,
    requiredKeys: ['baseUrl'],
    fields: [
      { key: 'baseUrl', label: 'Server URL', type: 'text', required: true, placeholder: 'http://localhost:4096', help: 'Start one with: opencode serve.' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Optional bearer token' },
      { key: 'model', label: 'Default Model', type: 'text', placeholder: 'anthropic/claude-sonnet-4.5' },
    ],
  },
  github: {
    id: 'github',
    name: 'GitHub',
    description: 'Token and default repo for the GitHub and HTTP nodes.',
    category: 'developer',
    testable: true,
    requiredKeys: ['token'],
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_... or github_pat_...', help: 'github.com/settings/tokens.' },
      { key: 'owner', label: 'Default Owner', type: 'text', placeholder: 'gabelmz' },
      { key: 'repo', label: 'Default Repository', type: 'text', placeholder: 'bernie' },
      { key: 'apiBaseUrl', label: 'API Base URL', type: 'text', placeholder: 'https://api.github.com', help: 'Change only for GitHub Enterprise.' },
    ],
  },
  http: {
    id: 'http',
    name: 'Custom HTTP Saves',
    description: 'A saved base URL and headers that HTTP nodes reuse.',
    category: 'developer',
    testable: true,
    requiredKeys: ['baseUrl'],
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'text', required: true, placeholder: 'https://api.example.com' },
      { key: 'authHeader', label: 'Authorization Header', type: 'password', placeholder: 'Bearer abc123', help: 'Sent as the Authorization header.' },
      { key: 'headers', label: 'Default Headers (JSON)', type: 'textarea', placeholder: '{"X-Api-Version": "2024-01"}' },
      { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', placeholder: '15000' },
    ],
  },
  mcp: {
    id: 'mcp',
    name: 'Model Context Protocol',
    description: 'List and call the tools an MCP server exposes.',
    category: 'developer',
    testable: true,
    requiredKeys: ['serverUrl'],
    fields: [
      {
        key: 'serverUrl',
        label: 'Server URL (Streamable HTTP)',
        type: 'text',
        required: true,
        placeholder: 'http://localhost:3001/mcp',
        help: 'Must be an http(s) endpoint. The websocket and SSE transports are not implemented.',
      },
    ],
  },
};

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfigMap = {
  asana: { includeCompleted: false, limit: 100 },
  keepa: { domain: 1, statsDays: 30 },
  supabase: { mode: 'insert' },
  sheets: { sheetName: 'Sheet1', mode: 'append', includeHeaders: true },
  drive: {},
  gemini: { model: 'gemini-3.1-pro-preview' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', appName: 'Bernie' },
  huggingface: {},
  opencode: { baseUrl: 'http://localhost:4096' },
  github: { apiBaseUrl: 'https://api.github.com' },
  http: { timeoutMs: 15000 },
  mcp: {},
};

/** The integrations belonging to one Connections-page group, in display order. */
export function integrationsInCategory(category: IntegrationCategory): IntegrationId[] {
  return INTEGRATION_IDS.filter((id) => INTEGRATION_SCHEMAS[id].category === category);
}

function isBlank(value: any): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Reports which required keys of an integration config are still unset.
 */
export function validateIntegrationConfig(
  id: IntegrationId,
  config: Record<string, any> | undefined | null
): { valid: boolean; missing: string[] } {
  const schema = INTEGRATION_SCHEMAS[id];
  if (!schema) return { valid: false, missing: ['unknown integration'] };

  const missing = schema.requiredKeys.filter((key) => isBlank(config?.[key]));
  return { valid: missing.length === 0, missing };
}

/**
 * Merges a saved integration config with per-node overrides. Blank overrides
 * never clobber a configured default.
 */
export function resolveConfig<T extends Record<string, any>>(base: T | undefined, overrides: Partial<T> | undefined): T {
  const merged: Record<string, any> = { ...(base || {}) };
  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (!isBlank(value)) merged[key] = value;
  });
  return merged as T;
}

/**
 * Normalizes any node payload into a list of flat row objects so that every
 * sink node (Supabase, Sheets) sees the same shape.
 */
export function toRows(input: any): Record<string, any>[] {
  if (input === undefined || input === null) return [];

  if (Array.isArray(input)) {
    return input.map((item) =>
      item !== null && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, any>) : { value: item }
    );
  }

  if (typeof input === 'object') {
    // Unwrap the common single-key envelopes our source nodes produce.
    for (const key of ['rows', 'items', 'data', 'tasks', 'products', 'results']) {
      if (Array.isArray((input as any)[key])) return toRows((input as any)[key]);
    }
    return [input as Record<string, any>];
  }

  return [{ value: input }];
}

/** Collects the union of keys across rows, preserving first-seen order. */
export function collectRowHeaders(rows: Record<string, any>[]): string[] {
  const headers: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });
  return headers;
}

function toCellValue(value: any): string | number | boolean {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

/**
 * Turns rows into the 2D `values` array the Google Sheets API expects.
 */
export function buildSheetValues(rows: Record<string, any>[], includeHeaders = true): (string | number | boolean)[][] {
  if (rows.length === 0) return [];
  const headers = collectRowHeaders(rows);
  if (headers.length === 0) return [];

  const values: (string | number | boolean)[][] = [];
  if (includeHeaders) values.push(headers);
  rows.forEach((row) => values.push(headers.map((header) => toCellValue(row?.[header]))));
  return values;
}

/** Parses a headers value that may arrive as an object or a JSON string. */
export function parseHeaders(value: any): Record<string, string> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined && val !== null) out[key] = String(val);
    });
    return out;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parseHeaders(parsed) : {};
    } catch {
      // A malformed header blob is ignored rather than failing the request.
      return {};
    }
  }
  return {};
}

export interface ResolvedHttpRequest {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Applies the saved "custom HTTP" defaults to a node's request: a relative URL
 * is resolved against the saved base URL, and the saved headers are merged
 * underneath the node's own, so per-node values always win.
 */
export function applyHttpDefaults(
  config: HttpConfig | undefined,
  request: { url?: string; headers?: Record<string, string> | string }
): ResolvedHttpRequest {
  const cfg = config || {};
  const baseUrl = String(cfg.baseUrl || '').trim().replace(/\/+$/, '');
  const rawUrl = String(request.url || '').trim();

  let url = rawUrl;
  if (rawUrl && !/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) && baseUrl) {
    url = `${baseUrl}/${rawUrl.replace(/^\/+/, '')}`;
  } else if (!rawUrl && baseUrl) {
    url = baseUrl;
  }

  const headers: Record<string, string> = parseHeaders(cfg.headers);
  const authHeader = String(cfg.authHeader || '').trim();
  if (authHeader) headers.Authorization = authHeader;
  Object.assign(headers, parseHeaders(request.headers));

  const timeoutMs = Number(cfg.timeoutMs);
  return {
    url,
    headers,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.trunc(timeoutMs) : undefined,
  };
}

export interface RowSummary {
  rowCount: number;
  fields: string[];
  numericSummary: Record<string, { min: number; max: number; mean: number; count: number }>;
}

/** Compact numeric summary of a row set, handed to the AI insights prompt. */
export function summarizeRows(rows: Record<string, any>[]): RowSummary {
  const fields = collectRowHeaders(rows);
  const numericSummary: RowSummary['numericSummary'] = {};

  fields.forEach((field) => {
    const values = rows
      .map((row) => row?.[field])
      .filter((value) => typeof value === 'number' && Number.isFinite(value)) as number[];

    if (values.length > 0) {
      const sum = values.reduce((acc, value) => acc + value, 0);
      numericSummary[field] = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: sum / values.length,
        count: values.length,
      };
    }
  });

  return { rowCount: rows.length, fields, numericSummary };
}
