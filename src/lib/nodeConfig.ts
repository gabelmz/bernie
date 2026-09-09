/**
 * Resolves the config one node runs with.
 *
 * Precedence, highest first:
 *   1. credentials typed into that node's edit view  (data.credentials)
 *   2. non-secret overrides on the node              (data.params)
 *   3. the saved connection under Connections & APIs
 *   4. server-side env vars, applied in the Express layer
 *
 * Keeping this in one place is what makes "I can always drop a key on the
 * node" true for every integration rather than per-node guesswork.
 */

import {
  INTEGRATION_SCHEMAS,
  IntegrationConfigMap,
  IntegrationField,
  IntegrationId,
  resolveConfig,
} from './integrationCore';
import { getIntegration } from './integrations';

/**
 * The secret fields of an integration. Password inputs are the secrets by
 * construction, so the credential block never drifts from the schema.
 */
export function credentialFields(id: IntegrationId): IntegrationField[] {
  return (INTEGRATION_SCHEMAS[id]?.fields || []).filter((field) => field.type === 'password');
}

/** The non-secret connection fields, shown as "defaults" rather than keys. */
export function settingFields(id: IntegrationId): IntegrationField[] {
  return (INTEGRATION_SCHEMAS[id]?.fields || []).filter((field) => field.type !== 'password');
}

export interface AppNodeConfigInput {
  /** Secrets typed into this node's edit view. */
  credentials?: Record<string, any>;
  /** Operation parameters, which may also override connection defaults. */
  params?: Record<string, any>;
}

function isBlank(value: any): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * The config to send with a node's run: the saved connection, with this node's
 * credentials layered on top. Blank node values never clobber a saved one.
 */
export function nodeConfigFor<K extends IntegrationId>(
  id: K,
  node: AppNodeConfigInput | undefined
): IntegrationConfigMap[K] {
  const saved = getIntegration(id);
  const overrides: Record<string, any> = {};

  // Only recognized schema keys are forwarded, so a stray param cannot
  // masquerade as a credential.
  const known = new Set((INTEGRATION_SCHEMAS[id]?.fields || []).map((field) => field.key));

  Object.entries(node?.params || {}).forEach(([key, value]) => {
    if (known.has(key) && !isBlank(value)) overrides[key] = value;
  });

  // Credentials win over everything the node carries.
  Object.entries(node?.credentials || {}).forEach(([key, value]) => {
    if (!isBlank(value)) overrides[key] = value;
  });

  return resolveConfig(saved, overrides as any);
}

/** Whether this node supplies its own key for any credential field. */
export function hasNodeCredentials(id: IntegrationId, node: AppNodeConfigInput | undefined): boolean {
  const keys = credentialFields(id).map((field) => field.key);
  return keys.some((key) => !isBlank(node?.credentials?.[key]));
}

/**
 * Which required credentials are still missing once the node and the saved
 * connection are combined — the message a node shows before it can run.
 */
export function missingCredentials(id: IntegrationId, node: AppNodeConfigInput | undefined): string[] {
  const config = nodeConfigFor(id, node) as Record<string, any>;
  return (INTEGRATION_SCHEMAS[id]?.requiredKeys || []).filter((key) => isBlank(config[key]));
}

/**
 * Maps the flat fields the old single-purpose nodes stored onto the operation
 * parameters the app-scoped nodes use, so a canvas saved before this change
 * still runs. Explicit params always win.
 */
const LEGACY_PARAM_KEYS: Partial<Record<IntegrationId, Record<string, string>>> = {
  asana: { projectGid: 'project', workspaceGid: 'workspace', assigneeGid: 'assignee', limit: 'limit' },
  keepa: { asins: 'asins', domain: 'domain', statsDays: 'stats' },
  sheets: { spreadsheetId: 'spreadsheetId', sheetName: 'range', includeHeaders: 'includeHeaders' },
  drive: { folderId: 'folderId', query: 'nameContains', pageSize: 'pageSize', fileId: 'fileId' },
  supabase: { table: 'table', onConflict: 'onConflict' },
  openrouter: { prompt: 'prompt', model: 'model', systemPrompt: 'systemPrompt', sampleSize: 'sampleSize' },
  huggingface: { prompt: 'prompt', model: 'model', sampleSize: 'sampleSize' },
  opencode: { prompt: 'prompt', model: 'model', sampleSize: 'sampleSize', sessionId: 'sessionId' },
  mcp: { tool: 'tool', toolArguments: 'arguments' },
  gemini: { prompt: 'prompt', model: 'model', focus: 'focus', sampleSize: 'sampleSize' },
};

/** The operation an old node's mode field corresponds to, if any. */
const LEGACY_OPERATIONS: Record<string, string> = {
  'sheets:append': 'values.append',
  'sheets:overwrite': 'values.update',
  'supabase:insert': 'rows.insert',
  'supabase:upsert': 'rows.upsert',
};

export function legacyParamsFor(id: IntegrationId, data: Record<string, any> | undefined): Record<string, any> {
  const mapping = LEGACY_PARAM_KEYS[id];
  if (!mapping || !data) return {};

  const params: Record<string, any> = {};
  Object.entries(mapping).forEach(([legacyKey, paramKey]) => {
    if (!isBlank(data[legacyKey])) params[paramKey] = data[legacyKey];
  });
  return params;
}

/** The operation an old node implied, used only when it has none recorded. */
export function legacyOperationFor(id: IntegrationId, data: Record<string, any> | undefined): string | undefined {
  const mode = data?.mode;
  if (!mode) return undefined;
  return LEGACY_OPERATIONS[`${id}:${mode}`];
}
