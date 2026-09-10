/**
 * Executes one operation for one integration. Plain REST operations go through
 * the shared request engine; the handful marked `custom` in the registry get a
 * dedicated branch here because they are not a single REST call.
 */

import { IntegrationId, summarizeRows, toRows } from '../lib/integrationCore';
import { OperationSpec, resolveOperation } from '../lib/operations';
import {
  buildOperationRequest,
  parseFilterLines,
  readResultPath,
  resolveParam,
  sheetValuesToRows,
  transportFor,
} from '../lib/operationEngine';
import {
  buildChatPrompt,
  buildHuggingFaceRequest,
  buildMcpRequest,
  buildOpenRouterRequest,
  buildOpencodeRequest,
  buildKeepaProductUrl,
  extractCompletionText,
  extractMcpCallResult,
  extractOpencodeText,
  mcpInitializeParams,
  normalizeAsanaTasks,
  normalizeKeepaProducts,
  normalizeMcpTools,
  parseAsinList,
  parseMcpResponseBody,
} from '../lib/providerRequests';
import { probe, readJsonResponse } from './runtime';

export const GEMINI_UNCONFIGURED = 'Gemini is not configured. Add an API key under Connections & APIs.';

/**
 * The only shape the runner needs from a Gemini client. Injecting it keeps the
 * Gemini SDK — which is Node-only — out of this module, so the Cloudflare
 * Worker can import the runner and hand in a REST-backed implementation.
 */
export interface GeminiClient {
  model: string;
  generateContent(request: {
    model: string;
    contents: string;
    config?: Record<string, any>;
  }): Promise<{ text: string | null }>;
}

export interface OperationResult {
  /** Rows to pass downstream, when the operation emits any. */
  rows?: Record<string, any>[];
  /** Free-form payload for operations that are not row-shaped. */
  data?: any;
  text?: string | null;
  meta?: Record<string, any>;
}

export interface RunContext {
  integration: IntegrationId;
  operationId: string;
  config: Record<string, any>;
  params: Record<string, any>;
  rows: Record<string, any>[];
  googleToken?: string;
  /** Supplied by the host runtime; absent means Gemini operations cannot run. */
  gemini?: (config: any) => GeminiClient | null;
}

/** An upstream 4xx/5xx, carrying the provider's own message and status. */
export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function fail(label: string, status: number, payload: any): never {
  const detail =
    payload?.errors?.[0]?.message ||
    payload?.error?.message ||
    payload?.message ||
    payload?.error_description ||
    payload?.hint ||
    (typeof payload === 'string' ? payload.slice(0, 300) : null);

  throw new UpstreamError(detail ? `${label}: ${detail}` : `${label} failed (${status}).`, status);
}

/** Shapes the response according to the operation's declared result type. */
function shapeResult(spec: OperationSpec, payload: any, params: Record<string, any>): OperationResult {
  const scoped = readResultPath(payload, spec.resultPath);

  switch (spec.result) {
    case 'asanaTasks':
      return { rows: normalizeAsanaTasks(Array.isArray(scoped) ? scoped : [scoped].filter(Boolean)) };
    case 'keepaProducts':
      return { rows: normalizeKeepaProducts(Array.isArray(scoped) ? scoped : payload?.products) };
    case 'sheetValues':
      return { rows: sheetValuesToRows(payload?.values, params.headerRow !== false), meta: { range: payload?.range } };
    case 'driveFiles':
      return { rows: normalizeDriveFiles(payload?.files) };
    case 'single':
      return { rows: scoped ? toRows(scoped) : [], data: scoped };
    case 'rows':
      return { rows: toRows(scoped) };
    case 'passthrough':
    default:
      return { rows: toRows(scoped), data: scoped };
  }
}

function normalizeDriveFiles(files: any): Record<string, any>[] {
  if (!Array.isArray(files)) return [];
  return files.map((file: any) => ({
    id: file?.id ?? null,
    name: file?.name ?? null,
    mime_type: file?.mimeType ?? null,
    modified_time: file?.modifiedTime ?? null,
    size_bytes: file?.size ? Number(file.size) : null,
    link: file?.webViewLink ?? null,
  }));
}

/** Sends a built REST request and shapes the response. */
async function runRest(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const request = buildOperationRequest({
    integration: ctx.integration,
    spec,
    params: ctx.params,
    config: ctx.config,
    rows: ctx.rows,
    googleToken: ctx.googleToken,
  });

  const response = await probe(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) fail(spec.label, response.status, payload);

  return shapeResult(spec, payload, ctx.params);
}

/* -------------------------------------------------------------------------- */
/* Custom handlers                                                            */
/* -------------------------------------------------------------------------- */

async function runSheetsPreview(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const result = await runRest(ctx, { ...spec, custom: undefined });
  const limit = Math.max(1, Number(ctx.params.previewRows) || 10);
  const rows = (result.rows || []).slice(0, limit);

  return {
    rows,
    meta: { ...result.meta, previewed: rows.length, truncated: (result.rows || []).length > rows.length },
  };
}

async function runSheetsMetadata(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const spreadsheetId = resolveParam('sheets', 'spreadsheetId', ctx.params, ctx.config);
  if (!spreadsheetId) throw new Error('Google Sheets: a spreadsheet ID is required.');

  const transport = transportFor('sheets', ctx.config, ctx.googleToken);
  const url = `${transport.baseUrl}/v4/spreadsheets/${encodeURIComponent(String(spreadsheetId))}?fields=properties.title,sheets.properties`;
  const response = await probe(url, { headers: transport.headers });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  const rows = Array.isArray(payload?.sheets)
    ? payload.sheets.map((sheet: any) => ({
        title: sheet?.properties?.title ?? null,
        sheet_id: sheet?.properties?.sheetId ?? null,
        rows: sheet?.properties?.gridProperties?.rowCount ?? null,
        columns: sheet?.properties?.gridProperties?.columnCount ?? null,
      }))
    : [];

  return { rows, meta: { spreadsheetTitle: payload?.properties?.title ?? null } };
}

async function runSheetsWrite(ctx: RunContext, spec: OperationSpec, kind: 'addTab' | 'create'): Promise<OperationResult> {
  const transport = transportFor('sheets', ctx.config, ctx.googleToken);
  const title = String(ctx.params.title || '').trim();
  if (!title) throw new Error('Google Sheets: a title is required.');

  let url: string;
  let body: any;
  if (kind === 'create') {
    url = `${transport.baseUrl}/v4/spreadsheets`;
    body = { properties: { title } };
  } else {
    const spreadsheetId = resolveParam('sheets', 'spreadsheetId', ctx.params, ctx.config);
    if (!spreadsheetId) throw new Error('Google Sheets: a spreadsheet ID is required.');
    url = `${transport.baseUrl}/v4/spreadsheets/${encodeURIComponent(String(spreadsheetId))}:batchUpdate`;
    body = { requests: [{ addSheet: { properties: { title } } }] };
  }

  const response = await probe(url, { method: 'POST', headers: transport.headers, body: JSON.stringify(body) });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  return {
    data: payload,
    rows: [
      {
        spreadsheet_id: payload?.spreadsheetId ?? resolveParam('sheets', 'spreadsheetId', ctx.params, ctx.config) ?? null,
        title,
        url: payload?.spreadsheetUrl ?? null,
      },
    ],
  };
}

async function runSupabaseSelect(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('supabase', ctx.config, ctx.googleToken);
  const table = resolveParam('supabase', 'table', ctx.params, ctx.config);
  if (!table) throw new Error('Supabase: a target table is required.');

  const url = new URL(`${transport.baseUrl}/rest/v1/${encodeURIComponent(String(table))}`);
  url.searchParams.set('select', String(ctx.params.select || '*'));
  parseFilterLines(ctx.params.filters).forEach(([column, value]) => url.searchParams.append(column, value));
  if (ctx.params.order) url.searchParams.set('order', String(ctx.params.order));
  if (ctx.params.limit) url.searchParams.set('limit', String(ctx.params.limit));
  if (ctx.params.offset) url.searchParams.set('offset', String(ctx.params.offset));

  const response = await probe(url.toString(), { headers: transport.headers });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  return { rows: toRows(payload) };
}

async function runSupabaseCount(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('supabase', ctx.config, ctx.googleToken);
  const table = resolveParam('supabase', 'table', ctx.params, ctx.config);
  if (!table) throw new Error('Supabase: a target table is required.');

  const url = new URL(`${transport.baseUrl}/rest/v1/${encodeURIComponent(String(table))}`);
  url.searchParams.set('select', 'id');
  parseFilterLines(ctx.params.filters).forEach(([column, value]) => url.searchParams.append(column, value));

  const response = await probe(url.toString(), {
    headers: { ...transport.headers, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!response.ok) fail(spec.label, response.status, await readJsonResponse(response));

  // PostgREST reports the total in Content-Range as "0-0/123".
  const range = response.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);

  return { rows: [{ table: String(table), count: Number.isFinite(total) ? total : null }] };
}

async function runSupabaseWrite(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('supabase', ctx.config, ctx.googleToken);
  const table = resolveParam('supabase', 'table', ctx.params, ctx.config);
  if (!table) throw new Error('Supabase: a target table is required.');

  const filters = parseFilterLines(ctx.params.filters);
  const needsFilter = spec.method === 'PATCH' || spec.method === 'DELETE';
  if (needsFilter && filters.length === 0) {
    throw new Error(
      `${spec.label}: add at least one filter. Without one PostgREST would touch every row in ${table}.`
    );
  }

  if (spec.consumesRows && ctx.rows.length === 0) {
    throw new Error(`${spec.label}: no input rows. Connect a source node and run it first.`);
  }

  const url = new URL(`${transport.baseUrl}/rest/v1/${encodeURIComponent(String(table))}`);
  filters.forEach(([column, value]) => url.searchParams.append(column, value));

  const prefer = ['return=representation'];
  const onConflict = resolveParam('supabase', 'onConflict', ctx.params, ctx.config);
  if (spec.id === 'rows.upsert') {
    prefer.push('resolution=merge-duplicates');
    if (onConflict) url.searchParams.set('on_conflict', String(onConflict));
  }

  // PATCH sends a single object of changes, not an array.
  const body = spec.method === 'PATCH' ? JSON.stringify(ctx.rows[0] ?? {}) : JSON.stringify(ctx.rows);

  const response = await probe(url.toString(), {
    method: spec.method,
    headers: { ...transport.headers, Prefer: prefer.join(',') },
    body: spec.method === 'DELETE' ? undefined : body,
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  const written = Array.isArray(payload) ? payload.length : ctx.rows.length;
  return { rows: toRows(payload), meta: { table: String(table), written, mode: spec.id } };
}

/** Keepa's documented per-request ASIN limit for /product. */
const KEEPA_BATCH_SIZE = 100;

async function runKeepaProduct(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const asins = parseAsinList(resolveParam('keepa', 'asins', ctx.params, ctx.config));
  const fromRows = ctx.rows.map((row) => row?.asin).filter(Boolean);
  const list = asins.length > 0 ? asins : parseAsinList(fromRows);

  const keepaConfig = {
    apiKey: ctx.config.apiKey,
    domain: resolveParam('keepa', 'domain', ctx.params, ctx.config),
    statsDays: resolveParam('keepa', 'stats', ctx.params, ctx.config),
  };

  // Keepa caps one request at 100 ASINs and buildKeepaProductUrl silently
  // truncates to fit, so anything longer has to go a batch at a time. A sheet
  // of issues is routinely longer than 100.
  const products: Record<string, any>[] = [];
  let tokensLeft: number | null = null;

  for (let start = 0; start < list.length; start += KEEPA_BATCH_SIZE) {
    const batch = list.slice(start, start + KEEPA_BATCH_SIZE);
    const response = await probe(buildKeepaProductUrl(keepaConfig, batch), {
      headers: { Accept: 'application/json' },
    });
    const payload = await readJsonResponse(response);
    if (!response.ok || payload?.error) fail(spec.label, response.ok ? 400 : response.status, payload);

    products.push(...normalizeKeepaProducts(payload?.products));
    if (payload?.tokensLeft !== undefined && payload?.tokensLeft !== null) tokensLeft = payload.tokensLeft;
  }

  const rows = ctx.params.mergeInputRows ? mergeKeepaIntoRows(ctx.rows, products) : products;

  return {
    rows,
    meta: {
      tokensLeft,
      requestedAsins: list,
      matched: products.length,
      batches: Math.ceil(list.length / KEEPA_BATCH_SIZE),
    },
  };
}

/**
 * Re-attaches each product to the row its ASIN came from, so whatever the
 * upstream node knew about the ASIN survives the lookup. Rows Keepa returned
 * nothing for are kept, with the product fields absent rather than zeroed.
 */
function mergeKeepaIntoRows(
  rows: Record<string, any>[],
  products: Record<string, any>[]
): Record<string, any>[] {
  if (rows.length === 0) return products;

  const byAsin = new Map<string, Record<string, any>>();
  products.forEach((product) => {
    const asin = String(product.asin ?? '').trim().toUpperCase();
    if (asin) byAsin.set(asin, product);
  });

  return rows.map((row) => {
    const asin = String(row?.asin ?? '').trim().toUpperCase();
    const product = asin ? byAsin.get(asin) : undefined;
    return product ? { ...row, ...product } : { ...row };
  });
}

async function runDriveList(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('drive', ctx.config, ctx.googleToken);
  const folderId = resolveParam('drive', 'folderId', ctx.params, ctx.config);

  const clauses = ['trashed = false'];
  if (folderId) clauses.push(`'${String(folderId).replace(/'/g, "\\'")}' in parents`);
  if (ctx.params.nameContains) clauses.push(`name contains '${String(ctx.params.nameContains).replace(/'/g, "\\'")}'`);
  if (ctx.params.mimeType) clauses.push(`mimeType = '${String(ctx.params.mimeType).replace(/'/g, "\\'")}'`);

  const url = new URL(`${transport.baseUrl}/drive/v3/files`);
  url.searchParams.set('q', clauses.join(' and '));
  url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,size,webViewLink)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', String(Math.min(Number(ctx.params.pageSize) || 25, 100)));

  const response = await probe(url.toString(), { headers: transport.headers });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  return { rows: normalizeDriveFiles(payload?.files) };
}

async function runDriveGet(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('drive', ctx.config, ctx.googleToken);
  const fileId = String(ctx.params.fileId || '').trim();
  if (!fileId) throw new Error('Google Drive: a file ID is required.');

  const response = await probe(
    `${transport.baseUrl}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: transport.headers.Authorization } }
  );
  const text = await response.text();
  if (!response.ok) {
    let payload: any = text;
    try {
      payload = JSON.parse(text);
    } catch {}
    fail(spec.label, response.status, payload);
  }

  // JSON and CSV become rows; anything else flows on as text.
  try {
    const parsed = JSON.parse(text);
    return { rows: toRows(parsed), data: parsed };
  } catch {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1 && lines[0].includes(',')) {
      const matrix = lines.map((line) => line.split(','));
      return { rows: sheetValuesToRows(matrix, true) };
    }
    return { text, rows: [{ content: text }] };
  }
}

async function runDriveUpload(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('drive', ctx.config, ctx.googleToken);
  if (ctx.rows.length === 0) throw new Error(`${spec.label}: no input rows to write.`);

  const format = String(ctx.params.format || 'json');
  const name = String(ctx.params.name || (format === 'csv' ? 'export.csv' : 'export.json'));
  const folderId = resolveParam('drive', 'folderId', ctx.params, ctx.config);

  let content: string;
  let mimeType: string;
  if (format === 'csv') {
    const values = [Object.keys(ctx.rows[0]), ...ctx.rows.map((row) => Object.keys(ctx.rows[0]).map((key) => row[key]))];
    content = values
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    mimeType = 'text/csv';
  } else {
    content = JSON.stringify(ctx.rows, null, 2);
    mimeType = 'application/json';
  }

  const metadata: Record<string, any> = { name, mimeType };
  if (folderId) metadata.parents = [String(folderId)];

  // Multipart related upload, assembled by hand to avoid a FormData dependency.
  const boundary = `bernie-${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const response = await probe(`${transport.baseUrl}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: transport.headers.Authorization,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  return {
    data: payload,
    rows: [{ id: payload?.id ?? null, name: payload?.name ?? name, link: payload?.webViewLink ?? null }],
  };
}

async function runDriveSimple(
  ctx: RunContext,
  spec: OperationSpec,
  kind: 'createFolder' | 'trash'
): Promise<OperationResult> {
  const transport = transportFor('drive', ctx.config, ctx.googleToken);

  if (kind === 'trash') {
    const fileId = String(ctx.params.fileId || '').trim();
    if (!fileId) throw new Error('Google Drive: a file ID is required.');
    const response = await probe(`${transport.baseUrl}/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      headers: transport.headers,
      body: JSON.stringify({ trashed: true }),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) fail(spec.label, response.status, payload);
    return { rows: [{ id: fileId, trashed: true }], data: payload };
  }

  const name = String(ctx.params.name || '').trim();
  if (!name) throw new Error('Google Drive: a folder name is required.');
  const parent = resolveParam('drive', 'folderId', ctx.params, ctx.config);
  const metadata: Record<string, any> = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parent) metadata.parents = [String(parent)];

  const response = await probe(`${transport.baseUrl}/drive/v3/files?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: transport.headers,
    body: JSON.stringify(metadata),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  return { rows: [{ id: payload?.id ?? null, name, link: payload?.webViewLink ?? null }], data: payload };
}

async function runGithubList(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const result = await runRest(ctx, { ...spec, custom: undefined });
  const rows = (result.rows || []).map((item: any) => flattenGithub(item, spec.id));
  return { rows, meta: result.meta };
}

function flattenGithub(item: any, operationId: string): Record<string, any> {
  if (operationId === 'github.repos' || operationId === 'repos.list') {
    return {
      full_name: item?.full_name ?? null,
      name: item?.name ?? null,
      private: Boolean(item?.private),
      default_branch: item?.default_branch ?? null,
      stars: item?.stargazers_count ?? null,
      open_issues: item?.open_issues_count ?? null,
      updated_at: item?.updated_at ?? null,
      url: item?.html_url ?? null,
    };
  }
  return {
    number: item?.number ?? null,
    title: item?.title ?? null,
    state: item?.state ?? null,
    author: item?.user?.login ?? null,
    labels: Array.isArray(item?.labels) ? item.labels.map((l: any) => l?.name ?? l).join(', ') : null,
    assignees: Array.isArray(item?.assignees) ? item.assignees.map((a: any) => a?.login).join(', ') : null,
    comments: item?.comments ?? null,
    created_at: item?.created_at ?? null,
    updated_at: item?.updated_at ?? null,
    url: item?.html_url ?? null,
  };
}

/**
 * Asana creates one task per request, so a row set becomes a request per row.
 * The generic REST path would send only the first row, which is the wrong
 * answer for an operation whose whole point is writing a batch.
 */
async function runAsanaCreateTasks(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('asana', ctx.config, ctx.googleToken);
  if (ctx.rows.length === 0) throw new Error(`${spec.label}: no input rows to create tasks from.`);

  const projects = resolveParam('asana', 'projects', ctx.params, ctx.config);
  const workspace = resolveParam('asana', 'workspace', ctx.params, ctx.config);
  const assignee = resolveParam('asana', 'assignee', ctx.params, ctx.config);
  if (!projects && !workspace) {
    throw new Error('Asana: a project or workspace GID is required to create tasks.');
  }

  const created: Record<string, any>[] = [];
  for (const row of ctx.rows) {
    const name = String(row?.name ?? row?.title ?? '').trim();
    if (!name) throw new Error('Asana: every row needs a name to become a task.');

    // Node-level fields are the default; a row may override any of them.
    const data: Record<string, any> = { name };
    if (projects) data.projects = [String(projects)];
    if (workspace) data.workspace = String(workspace);
    if (assignee) data.assignee = String(assignee);

    Object.entries(row).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (key === 'title') return;
      data[key] = key === 'projects' && !Array.isArray(value) ? [String(value)] : value;
    });

    const response = await probe(`${transport.baseUrl}/tasks`, {
      method: 'POST',
      headers: transport.headers,
      body: JSON.stringify({ data }),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) fail(spec.label, response.status, payload);
    created.push(...normalizeAsanaTasks([payload?.data].filter(Boolean)));
  }

  return { rows: created, meta: { created: created.length } };
}

async function runGithubCreateIssues(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('github', ctx.config, ctx.googleToken);
  const owner = resolveParam('github', 'owner', ctx.params, ctx.config);
  const repo = resolveParam('github', 'repo', ctx.params, ctx.config);
  if (!owner || !repo) throw new Error('GitHub: an owner and repository are required.');
  if (ctx.rows.length === 0) throw new Error(`${spec.label}: no input rows to create issues from.`);

  const created: Record<string, any>[] = [];
  for (const row of ctx.rows) {
    const title = String(row.title ?? row.name ?? '').trim();
    if (!title) throw new Error('GitHub: every row needs a title to become an issue.');

    const body: Record<string, any> = { title };
    if (row.body ?? row.notes) body.body = String(row.body ?? row.notes);
    if (row.labels) {
      body.labels = String(row.labels)
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
    }

    const response = await probe(`${transport.baseUrl}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: transport.headers,
      body: JSON.stringify(body),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) fail(spec.label, response.status, payload);
    created.push(flattenGithub(payload, 'issues.create'));
  }

  return { rows: created, meta: { created: created.length } };
}

async function runGithubContent(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const result = await runRest(ctx, { ...spec, custom: undefined });
  const payload = result.data;

  if (payload?.content && payload?.encoding === 'base64') {
    // atob rather than Buffer, so this path also runs on Workers.
    const binary = atob(String(payload.content).replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    try {
      const parsed = JSON.parse(decoded);
      return { rows: toRows(parsed), data: parsed, text: decoded };
    } catch {
      return { rows: [{ path: payload?.path ?? null, content: decoded }], text: decoded };
    }
  }
  return result;
}

async function runChatCompletion(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const content = buildChatPrompt(
    String(ctx.params.prompt || ''),
    ctx.rows,
    Number(ctx.params.sampleSize) || 40
  );
  const model = resolveParam(ctx.integration, 'model', ctx.params, ctx.config);

  const request =
    ctx.integration === 'openrouter'
      ? buildOpenRouterRequest(ctx.config, content, { model, systemPrompt: ctx.params.systemPrompt })
      : buildHuggingFaceRequest(ctx.config, content, { model });

  const response = await probe(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  const text = extractCompletionText(payload);
  if (text === null) throw new UpstreamError(`${spec.label}: the provider returned no text.`, 502);

  return { text, rows: [{ text }], meta: { model: payload?.model ?? model ?? null, usage: payload?.usage ?? null } };
}

async function runHuggingFaceWhoami(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const transport = transportFor('huggingface', ctx.config);
  const response = await probe(`${transport.baseUrl}/api/whoami-v2`, { headers: transport.headers });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);
  return { rows: toRows({ name: payload?.name ?? null, type: payload?.type ?? null }), data: payload };
}

async function runOpencodePrompt(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const content = buildChatPrompt(String(ctx.params.prompt || ''), ctx.rows, Number(ctx.params.sampleSize) || 40);
  const request = buildOpencodeRequest(ctx.config, content, {
    model: resolveParam('opencode', 'model', ctx.params, ctx.config),
  });

  let sessionId = String(ctx.params.sessionId || '').trim();
  if (!sessionId) {
    const created = await probe(request.sessionUrl, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({}),
    });
    const payload = await readJsonResponse(created);
    if (!created.ok) fail(`${spec.label} (create session)`, created.status, payload);
    sessionId = String(payload?.id || payload?.sessionID || '').trim();
    if (!sessionId) throw new UpstreamError('opencode: the server returned a session without an id.', 502);
  }

  const response = await probe(request.messageUrl(sessionId), {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) fail(spec.label, response.status, payload);

  const text = extractOpencodeText(payload);
  return { text, rows: text ? [{ text }] : [], data: payload, meta: { sessionId } };
}

/** MCP needs the initialize handshake before every call, so it is bespoke. */
async function runMcp(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const method = spec.id === 'tools.call' ? 'tools/call' : spec.id.replace('.', '/');

  const init = buildMcpRequest(ctx.config, 'initialize', mcpInitializeParams(), 1);
  const initResponse = await probe(init.url, {
    method: 'POST',
    headers: init.headers,
    body: JSON.stringify(init.body),
  });
  const initText = await initResponse.text();
  if (!initResponse.ok) {
    throw new UpstreamError(`MCP: initialize failed (${initResponse.status}). ${initText.slice(0, 200)}`.trim(), initResponse.status);
  }
  const initPayload = parseMcpResponseBody(initText);
  if (initPayload?.error) {
    throw new UpstreamError(`MCP: ${initPayload.error?.message || 'initialize was rejected.'}`, 502);
  }
  const sessionId = initResponse.headers.get('mcp-session-id') || undefined;

  const notify = buildMcpRequest(ctx.config, 'notifications/initialized', {}, 2, sessionId);
  try {
    await probe(notify.url, {
      method: 'POST',
      headers: notify.headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    });
  } catch {
    // Servers that ignore the notification still answer calls.
  }

  let params: Record<string, any> = {};
  if (method === 'tools/call') {
    const tool = String(ctx.params.tool || '').trim();
    if (!tool) throw new Error('MCP: name the tool to call.');
    let args = ctx.params.arguments ?? {};
    if (typeof args === 'string' && args.trim()) {
      try {
        args = JSON.parse(args);
      } catch {
        throw new Error('MCP: the tool arguments are not valid JSON.');
      }
    }
    params = { name: tool, arguments: args || {} };
  }

  const call = buildMcpRequest(ctx.config, method, params, 3, sessionId);
  const response = await probe(call.url, {
    method: 'POST',
    headers: call.headers,
    body: JSON.stringify(call.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new UpstreamError(`MCP: ${method} failed (${response.status}). ${text.slice(0, 200)}`.trim(), response.status);
  }

  const payload = parseMcpResponseBody(text);
  if (payload?.error) {
    throw new UpstreamError(`MCP: ${payload.error?.message || 'the server returned an error.'}`, 502);
  }

  if (method === 'tools/call') {
    const { text: resultText, structured } = extractMcpCallResult(payload);
    return {
      text: resultText,
      rows: structured ? toRows(structured) : resultText ? [{ text: resultText }] : [],
      data: { text: resultText, structured, isError: Boolean(payload?.result?.isError) },
      meta: { tool: params.name },
    };
  }

  if (method === 'tools/list') {
    return { rows: normalizeMcpTools(payload), meta: { serverInfo: initPayload?.result?.serverInfo ?? null } };
  }

  // resources/list and prompts/list share a { result: { <plural>: [...] } } shape.
  const collection = payload?.result?.resources ?? payload?.result?.prompts ?? [];
  return { rows: toRows(collection), meta: { serverInfo: initPayload?.result?.serverInfo ?? null } };
}

async function runHttpRequest(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const request = buildOperationRequest({
    integration: 'http',
    spec: { ...spec, direction: 'raw' },
    params: ctx.params,
    config: ctx.config,
    rows: ctx.rows,
  });

  const response = await probe(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) fail('HTTP request', response.status, payload);

  return {
    rows: toRows(payload),
    data: payload,
    meta: { status: response.status, url: request.url, method: request.method },
  };
}

async function runGemini(ctx: RunContext, spec: OperationSpec): Promise<OperationResult> {
  const gemini = ctx.gemini?.(ctx.config);
  if (!gemini) throw new Error(GEMINI_UNCONFIGURED);

  const model = String(resolveParam('gemini', 'model', ctx.params, ctx.config) || gemini.model);

  if (spec.id === 'insights.generate') {
    if (ctx.rows.length === 0) throw new Error('Insights: connect a node that produces rows first.');

    const summary = summarizeRows(ctx.rows);
    const sampleSize = Math.min(Number(ctx.params.sampleSize) || 40, 200);
    const focus = String(ctx.params.focus || '').trim();

    const prompt = `
      You are a data analyst embedded in a workflow automation canvas.
      Analyse the dataset below and report what matters, grounded strictly in the data provided.

      ${focus ? `Analysis focus from the user: ${focus}` : 'No specific focus was given; report the most decision-relevant findings.'}

      Dataset shape:
      ${JSON.stringify(summary, null, 2)}

      Sample rows (first ${Math.min(sampleSize, ctx.rows.length)} of ${ctx.rows.length}):
      ${JSON.stringify(ctx.rows.slice(0, sampleSize), null, 2)}

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

    const response = await gemini.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    let insights: any;
    try {
      insights = JSON.parse(response.text || '{}');
    } catch {
      throw new UpstreamError('Insights: the model returned a response that was not valid JSON.', 502);
    }

    return { data: { insights }, rows: [], meta: { rowCount: summary.rowCount, fields: summary.fields } };
  }

  const content = buildChatPrompt(String(ctx.params.prompt || ''), ctx.rows, Number(ctx.params.sampleSize) || 40);
  const response = await gemini.generateContent({ model, contents: content });
  const text = response.text ?? null;

  return { text, rows: text ? [{ text }] : [], meta: { model } };
}

/* -------------------------------------------------------------------------- */

const CUSTOM_HANDLERS: Record<string, (ctx: RunContext, spec: OperationSpec) => Promise<OperationResult>> = {
  'sheets.preview': runSheetsPreview,
  'sheets.metadata': runSheetsMetadata,
  'sheets.addTab': (ctx, spec) => runSheetsWrite(ctx, spec, 'addTab'),
  'sheets.create': (ctx, spec) => runSheetsWrite(ctx, spec, 'create'),
  'supabase.select': runSupabaseSelect,
  'supabase.count': runSupabaseCount,
  'supabase.write': runSupabaseWrite,
  'keepa.product': runKeepaProduct,
  'asana.createTasks': runAsanaCreateTasks,
  'drive.list': runDriveList,
  'drive.get': runDriveGet,
  'drive.upload': runDriveUpload,
  'drive.createFolder': (ctx, spec) => runDriveSimple(ctx, spec, 'createFolder'),
  'drive.trash': (ctx, spec) => runDriveSimple(ctx, spec, 'trash'),
  'github.issues': runGithubList,
  'github.pulls': runGithubList,
  'github.repos': runGithubList,
  'github.createIssues': runGithubCreateIssues,
  'github.content': runGithubContent,
  'openrouter.complete': runChatCompletion,
  'huggingface.complete': runChatCompletion,
  'huggingface.whoami': runHuggingFaceWhoami,
  'opencode.prompt': runOpencodePrompt,
  'mcp.rpc': runMcp,
  'http.request': runHttpRequest,
  'gemini.generate': runGemini,
  'gemini.insights': runGemini,
};

/** Runs one operation, returning rows plus whatever metadata it produced. */
export async function runOperation(ctx: RunContext): Promise<OperationResult & { operation: string }> {
  const spec = resolveOperation(ctx.integration, ctx.operationId);
  if (!spec) {
    throw new Error(`${ctx.integration} has no operation "${ctx.operationId}".`);
  }

  if (spec.consumesRows && ctx.rows.length === 0 && spec.custom !== 'keepa.product') {
    throw new Error(`${spec.label}: no input rows. Connect a source node and run it first.`);
  }

  const handler = spec.custom ? CUSTOM_HANDLERS[spec.custom] : undefined;
  if (spec.custom && !handler) {
    throw new Error(`${spec.label} is declared custom but has no handler.`);
  }

  const result = handler ? await handler(ctx, spec) : await runRest(ctx, spec);
  return { ...result, operation: spec.id };
}
