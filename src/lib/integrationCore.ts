/**
 * Pure, dependency-free integration logic shared by the Express server and the
 * React nodes. Nothing in here may touch the DOM, React, or Node built-ins so
 * that it can be bundled into `dist/server.cjs` and unit tested in isolation.
 */

export type IntegrationId = 'asana' | 'keepa' | 'supabase' | 'sheets';

export const INTEGRATION_IDS: IntegrationId[] = ['asana', 'keepa', 'supabase', 'sheets'];

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

export interface IntegrationConfigMap {
  asana: AsanaConfig;
  keepa: KeepaConfig;
  supabase: SupabaseConfig;
  sheets: SheetsConfig;
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
  /** Fields that must be present before any node of this kind can run. */
  requiredKeys: string[];
  fields: IntegrationField[];
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
    description: 'Push rows into a Postgres table over the REST API.',
    requiredKeys: ['url', 'apiKey'],
    fields: [
      { key: 'url', label: 'Project URL', type: 'text', required: true, placeholder: 'https://xxxxx.supabase.co' },
      { key: 'apiKey', label: 'Service Role / Anon Key', type: 'password', required: true, placeholder: 'eyJhbGciOi...' },
      { key: 'table', label: 'Default Table', type: 'text', placeholder: 'products' },
      { key: 'mode', label: 'Write Mode', type: 'select', options: [{ value: 'insert', label: 'Insert' }, { value: 'upsert', label: 'Upsert (merge duplicates)' }] },
      { key: 'onConflict', label: 'On Conflict Column(s)', type: 'text', placeholder: 'asin', help: 'Comma separated, required for upsert.' },
    ],
  },
  sheets: {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Push rows into a spreadsheet tab.',
    requiredKeys: ['spreadsheetId'],
    fields: [
      { key: 'spreadsheetId', label: 'Default Spreadsheet ID', type: 'text', required: true, placeholder: '1BxiMVs0XRY...', help: 'The long id in the sheet URL.' },
      { key: 'sheetName', label: 'Default Tab Name', type: 'text', placeholder: 'Sheet1' },
      { key: 'mode', label: 'Write Mode', type: 'select', options: [{ value: 'append', label: 'Append rows' }, { value: 'overwrite', label: 'Overwrite from A1' }] },
      { key: 'includeHeaders', label: 'Write a header row', type: 'checkbox' },
      { key: 'accessToken', label: 'OAuth Access Token Override', type: 'password', placeholder: 'ya29...', help: 'Optional. Leave blank to use the connected Google account.' },
    ],
  },
};

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfigMap = {
  asana: { includeCompleted: false, limit: 100 },
  keepa: { domain: 1, statsDays: 30 },
  supabase: { mode: 'insert' },
  sheets: { sheetName: 'Sheet1', mode: 'append', includeHeaders: true },
};

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
