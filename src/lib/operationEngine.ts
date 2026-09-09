/**
 * Turns an operation spec plus its parameters into a concrete HTTP request.
 * Pure and dependency-free, so the same builder runs on the server and is unit
 * testable without a network.
 */

import { IntegrationId, buildSheetValues, collectRowHeaders, parseHeaders } from './integrationCore';
import { OperationSpec } from './operations';

export interface BuiltRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface Transport {
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Where each integration's API lives and how it authenticates. Google's two
 * integrations authorize with the OAuth token from sign-in, which arrives
 * separately from the stored config.
 */
export function transportFor(
  integration: IntegrationId,
  config: Record<string, any>,
  googleToken?: string
): Transport {
  const json = { 'Content-Type': 'application/json' };

  switch (integration) {
    case 'asana': {
      const token = String(config.accessToken || '').trim();
      if (!token) throw new Error('Asana: a personal access token is required.');
      return {
        baseUrl: 'https://app.asana.com/api/1.0',
        headers: { ...json, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      };
    }
    case 'keepa':
      // Keepa authenticates with a query parameter, added per request.
      return { baseUrl: 'https://api.keepa.com', headers: { Accept: 'application/json' } };

    case 'supabase': {
      const base = String(config.url || '').trim().replace(/\/+$/, '');
      if (!base) throw new Error('Supabase: a project URL is required.');
      const apiKey = String(config.apiKey || '').trim();
      if (!apiKey) throw new Error('Supabase: an API key is required.');
      return { baseUrl: base, headers: { ...json, apikey: apiKey, Authorization: `Bearer ${apiKey}` } };
    }

    case 'sheets':
    case 'drive': {
      const token = String(googleToken || config.accessToken || '').trim();
      if (!token) {
        throw new Error('No Google access. Sign in with Google under Connections & APIs, or use companion code.');
      }
      const baseUrl = integration === 'sheets' ? 'https://sheets.googleapis.com' : 'https://www.googleapis.com';
      return { baseUrl, headers: { ...json, Authorization: `Bearer ${token}` } };
    }

    case 'github': {
      const token = String(config.token || '').trim();
      if (!token) throw new Error('GitHub: a personal access token is required.');
      return {
        baseUrl: String(config.apiBaseUrl || 'https://api.github.com').trim().replace(/\/+$/, ''),
        headers: {
          ...json,
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'bernie-workflow-canvas',
        },
      };
    }

    case 'openrouter': {
      const apiKey = String(config.apiKey || '').trim();
      if (!apiKey) throw new Error('OpenRouter: an API key is required.');
      const headers: Record<string, string> = { ...json, Authorization: `Bearer ${apiKey}` };
      const appName = String(config.appName || '').trim();
      if (appName) headers['X-Title'] = appName;
      return {
        baseUrl: String(config.baseUrl || 'https://openrouter.ai/api/v1').trim().replace(/\/+$/, ''),
        headers,
      };
    }

    case 'huggingface': {
      const token = String(config.token || '').trim();
      if (!token) throw new Error('Hugging Face: an access token is required.');
      return { baseUrl: 'https://huggingface.co', headers: { ...json, Authorization: `Bearer ${token}` } };
    }

    case 'opencode': {
      const base = String(config.baseUrl || '').trim().replace(/\/+$/, '');
      if (!base) throw new Error('opencode: a server URL is required.');
      const headers: Record<string, string> = { ...json };
      const apiKey = String(config.apiKey || '').trim();
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      return { baseUrl: base, headers };
    }

    case 'mcp': {
      const url = String(config.serverUrl || '').trim();
      if (!url) throw new Error('MCP: a server URL is required.');
      return { baseUrl: url, headers: { ...json, Accept: 'application/json, text/event-stream' } };
    }

    case 'http': {
      const headers: Record<string, string> = { ...json, ...parseHeaders(config.headers) };
      const authHeader = String(config.authHeader || '').trim();
      if (authHeader) headers.Authorization = authHeader;
      return { baseUrl: String(config.baseUrl || '').trim().replace(/\/+$/, ''), headers };
    }

    default:
      throw new Error(`${integration} has no REST transport.`);
  }
}

/**
 * Which stored config key backs each operation parameter, so a node can leave
 * a field blank and inherit the connection default.
 */
const PARAM_DEFAULTS: Partial<Record<IntegrationId, Record<string, string>>> = {
  asana: { workspace: 'workspaceGid', project: 'projectGid', projectGid: 'projectGid', assignee: 'assigneeGid' },
  sheets: { spreadsheetId: 'spreadsheetId', range: 'sheetName' },
  drive: { folderId: 'folderId' },
  supabase: { table: 'table', onConflict: 'onConflict' },
  keepa: { asins: 'asins', domain: 'domain', stats: 'statsDays' },
  github: { owner: 'owner', repo: 'repo' },
  openrouter: { model: 'model' },
  huggingface: { model: 'model' },
  opencode: { model: 'model' },
  gemini: { model: 'model' },
};

function isBlank(value: any): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Literal defaults for parameters that have a single obvious value, so an
 * operation still runs when neither the node nor the stored config sets one.
 */
const PARAM_FALLBACKS: Partial<Record<IntegrationId, Record<string, any>>> = {
  sheets: { range: 'Sheet1' },
  keepa: { domain: 1 },
};

/**
 * A parameter's effective value: the node's own, else the connection default.
 */
export function resolveParam(
  integration: IntegrationId,
  key: string,
  params: Record<string, any>,
  config: Record<string, any>
): any {
  if (!isBlank(params?.[key])) return params[key];

  const configKey = PARAM_DEFAULTS[integration]?.[key];
  if (configKey && !isBlank(config?.[configKey])) return config[configKey];

  return PARAM_FALLBACKS[integration]?.[key];
}

/** Reads a dot path out of a payload, e.g. "data" or "updates.updatedRange". */
export function readResultPath(payload: any, path?: string): any {
  if (!path) return payload;
  return path.split('.').reduce((acc: any, key) => (acc === null || acc === undefined ? acc : acc[key]), payload);
}

/** Parses PostgREST filter lines into `column=op.value` pairs. */
export function parseFilterLines(raw: any): [string, string][] {
  if (!raw) return [];

  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const pairs: [string, string][] = [];

  String(text)
    .split(/[\n;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        pairs.push([line.slice(0, eq).trim(), line.slice(eq + 1).trim()]);
      }
    });

  return pairs;
}

/**
 * Turns a Sheets `values` matrix into rows. With a header row, the first row
 * supplies the keys; without one, keys are positional (col_1, col_2, ...).
 */
export function sheetValuesToRows(values: any, headerRow = true): Record<string, any>[] {
  if (!Array.isArray(values) || values.length === 0) return [];

  const matrix: any[][] = values.map((row: any) => (Array.isArray(row) ? row : [row]));
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);

  if (!headerRow) {
    return matrix.map((row) => {
      const out: Record<string, any> = {};
      for (let i = 0; i < width; i += 1) out[`col_${i + 1}`] = row[i] ?? '';
      return out;
    });
  }

  const rawHeaders = matrix[0] || [];
  const headers: string[] = [];
  for (let i = 0; i < width; i += 1) {
    const name = String(rawHeaders[i] ?? '').trim();
    // Blank or duplicate headers still need a stable, distinct key.
    let key = name || `col_${i + 1}`;
    let suffix = 2;
    while (headers.includes(key)) {
      key = `${name || `col_${i + 1}`}_${suffix}`;
      suffix += 1;
    }
    headers.push(key);
  }

  return matrix.slice(1).map((row) => {
    const out: Record<string, any> = {};
    headers.forEach((header, i) => {
      out[header] = row[i] ?? '';
    });
    return out;
  });
}

function parseJsonParam(value: any, label: string): any {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export interface BuildContext {
  integration: IntegrationId;
  spec: OperationSpec;
  params: Record<string, any>;
  config: Record<string, any>;
  rows: Record<string, any>[];
  googleToken?: string;
}

/**
 * Builds the request for a plain REST operation. Operations marked `custom`
 * are handled by the server instead and must not reach this function.
 */
export function buildOperationRequest(ctx: BuildContext): BuiltRequest {
  const { integration, spec, params, config, rows } = ctx;
  const transport = transportFor(integration, config, ctx.googleToken);

  const method = spec.direction === 'raw' ? String(params.rawMethod || spec.method) : spec.method;

  // --- path -------------------------------------------------------------
  let path = spec.path;
  if (spec.direction === 'raw') {
    const rawPath = String(params.rawPath || '').trim();
    if (!rawPath) throw new Error('Raw request: a path is required.');
    path = rawPath.startsWith('http') ? rawPath : `/${rawPath.replace(/^\/+/, '')}`;
  } else {
    const missing: string[] = [];
    path = path.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const value = resolveParam(integration, key, params, config);
      if (isBlank(value)) {
        missing.push(key);
        return '';
      }
      return encodeURIComponent(String(value));
    });
    if (missing.length > 0) {
      throw new Error(`${spec.label}: missing ${missing.join(', ')}.`);
    }
  }

  const url = new URL(path.startsWith('http') ? path : `${transport.baseUrl}${path}`);

  // --- query ------------------------------------------------------------
  (spec.query || []).forEach((key) => {
    const value = resolveParam(integration, key, params, config);
    if (!isBlank(value)) url.searchParams.set(key, String(value));
  });

  if (spec.direction === 'raw') {
    const extra = parseJsonParam(params.rawQuery, 'Query');
    if (extra && typeof extra === 'object') {
      Object.entries(extra).forEach(([key, value]) => {
        if (!isBlank(value)) url.searchParams.set(key, String(value));
      });
    }
  }

  // --- headers ----------------------------------------------------------
  const headers = { ...transport.headers };
  if (spec.direction === 'raw') {
    Object.assign(headers, parseHeaders(params.rawHeaders));
  }

  // --- body -------------------------------------------------------------
  let body: string | undefined;
  const bodySource = spec.body || 'none';
  const methodTakesBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';

  if (methodTakesBody) {
    if (bodySource === 'rows') {
      body = JSON.stringify(rows);
    } else if (bodySource === 'params') {
      body = JSON.stringify(params);
    } else if (bodySource === 'rawBody') {
      const parsed = parseJsonParam(params.rawBody, 'Body');
      body = JSON.stringify(parsed !== undefined ? parsed : rows);
    } else if (bodySource === 'asanaData') {
      body = JSON.stringify({ data: buildAsanaWriteData(spec, params, config, rows) });
    } else if (bodySource === 'sheetValues') {
      const range = String(resolveParam(integration, 'range', params, config) || 'Sheet1');
      body = JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: buildSheetValues(rows, params.includeHeaders !== false),
      });
    }
  }

  if (!body) delete headers['Content-Type'];

  return { method, url: url.toString(), headers, body };
}

/**
 * Asana write payloads: the operation's own fields, plus the first input row
 * for single-object writes. Row keys win, so a workflow can set any field.
 */
function buildAsanaWriteData(
  spec: OperationSpec,
  params: Record<string, any>,
  config: Record<string, any>,
  rows: Record<string, any>[]
): Record<string, any> {
  const data: Record<string, any> = {};

  (spec.fields || []).forEach((field) => {
    // Path placeholders are part of the URL, not the body.
    if (spec.path.includes(`{${field.key}}`)) return;
    const value = resolveParam('asana', field.key, params, config);
    if (isBlank(value)) return;

    // `projects` takes an array of GIDs.
    data[field.key] = field.key === 'projects' ? [String(value)] : value;
  });

  if (spec.consumesRows && rows.length > 0) {
    Object.entries(rows[0]).forEach(([key, value]) => {
      if (!isBlank(value)) data[key] = value;
    });
  }

  return data;
}

/** Columns a preview should show, for the node's little table. */
export function previewColumns(rows: Record<string, any>[], limit = 6): string[] {
  return collectRowHeaders(rows).slice(0, limit);
}
