/**
 * The operation registry. Every app-scoped node reads its operation list from
 * here, and the server dispatches on the same specs, so the picker in the UI
 * and the calls the server can make never drift apart.
 */

import { IntegrationId } from '../integrationCore';
import { asanaOperations } from './asana';
import { driveOperations, sheetsOperations } from './google';
import { githubOperations, keepaOperations, supabaseOperations } from './data';
import { aiOperations, httpOperations, mcpOperations } from './tools';
import { IntegrationOperations, OperationSpec } from './types';

export * from './types';

const REGISTRY: Partial<Record<IntegrationId, IntegrationOperations>> = {
  asana: asanaOperations,
  sheets: sheetsOperations,
  drive: driveOperations,
  supabase: supabaseOperations,
  keepa: keepaOperations,
  github: githubOperations,
  openrouter: aiOperations.openrouter,
  huggingface: aiOperations.huggingface,
  opencode: aiOperations.opencode,
  gemini: aiOperations.gemini,
  mcp: mcpOperations,
  http: httpOperations,
};

/** The operations an integration supports, or an empty list if it has none. */
export function operationsFor(id: IntegrationId): OperationSpec[] {
  return REGISTRY[id]?.operations ?? [];
}

/** The operation a freshly dropped node starts on. */
export function defaultOperationFor(id: IntegrationId): string {
  return REGISTRY[id]?.defaultOperation ?? '';
}

/** Looks up one operation spec, or null when the id is unknown. */
export function findOperation(id: IntegrationId, operationId: string): OperationSpec | null {
  return operationsFor(id).find((op) => op.id === operationId) ?? null;
}

/**
 * Resolves the operation a node should run: its own choice when valid, the
 * integration default otherwise, so a stale id never leaves a node dead.
 */
export function resolveOperation(id: IntegrationId, operationId?: string): OperationSpec | null {
  if (operationId) {
    const match = findOperation(id, operationId);
    if (match) return match;
  }
  return findOperation(id, defaultOperationFor(id));
}

/** True when the integration is driven by the operation registry. */
export function hasOperations(id: IntegrationId): boolean {
  return operationsFor(id).length > 0;
}

export const INTEGRATIONS_WITH_OPERATIONS = Object.keys(REGISTRY) as IntegrationId[];
