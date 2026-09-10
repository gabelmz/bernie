/**
 * The body of POST /api/integrations/execute, with no HTTP framework in it.
 *
 * Express and the Cloudflare Worker both call this, so a node behaves the same
 * whichever one is serving it — and there is one place to fix when it does not.
 */

import { IntegrationId, toRows, validateIntegrationConfig } from '../lib/integrationCore';
import { findOperation, resolveOperation } from '../lib/operations';
import { GeminiClient, UpstreamError, runOperation } from './operationRunner';
import { EnvSource, ambientEnv, mergedConfig } from './runtime';

export interface ExecuteDeps {
  /** Env bag the integration defaults are read from. */
  env?: EnvSource;
  /** Absent means Gemini operations report themselves unconfigured. */
  gemini?: (config: any) => GeminiClient | null;
}

export interface ExecuteOutcome {
  status: number;
  body: Record<string, any>;
}

export async function executeOperation(payload: any, deps: ExecuteDeps = {}): Promise<ExecuteOutcome> {
  const env = deps.env ?? ambientEnv();
  const integration = String(payload?.integration || '') as IntegrationId;
  const operationId = String(payload?.operation || '');

  const spec = resolveOperation(integration, operationId);
  if (!spec) {
    return {
      status: 400,
      body: {
        error: operationId
          ? `Unknown operation "${operationId}" for "${integration}".`
          : `"${integration}" has no operations.`,
      },
    };
  }

  // A requested-but-unknown operation is a bug worth reporting, not a silent
  // fallback to the default.
  if (operationId && !findOperation(integration, operationId)) {
    return { status: 400, body: { error: `Unknown operation "${operationId}" for "${integration}".` } };
  }

  const config = mergedConfig<Record<string, any>>(integration, payload?.config, env);

  const { valid, missing } = validateIntegrationConfig(integration, config);
  if (!valid) {
    return {
      status: 400,
      body: {
        error: `${integration} is not configured yet: missing ${missing.join(', ')}.`,
        missing,
      },
    };
  }

  try {
    const result = await runOperation({
      integration,
      operationId: spec.id,
      config,
      params: payload?.params || {},
      rows: toRows(payload?.rows ?? payload?.input),
      googleToken: payload?.accessToken,
      gemini: deps.gemini,
    });

    return {
      status: 200,
      body: {
        integration,
        operation: result.operation,
        direction: spec.direction,
        rows: result.rows ?? [],
        count: (result.rows ?? []).length,
        data: result.data ?? null,
        text: result.text ?? null,
        meta: result.meta ?? null,
        ranAt: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    const status = err instanceof UpstreamError ? err.status : 400;
    return { status, body: { error: err?.message || `${spec.label} failed.` } };
  }
}
