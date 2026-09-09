/**
 * The single entry point every app-scoped node calls:
 *   POST /api/integrations/execute
 *   { integration, operation, config, params, rows, accessToken }
 *
 * `config` arrives already merged in the browser (node credentials over the
 * saved connection), and env vars fill any remaining gaps server-side.
 */

import type { Express } from 'express';
import { IntegrationId, toRows, validateIntegrationConfig } from '../lib/integrationCore';
import { findOperation, operationsFor, resolveOperation } from '../lib/operations';
import { UpstreamError, runOperation } from './operationRunner';
import { mergedConfig } from './integrationKit';

export function registerExecuteRoute(app: Express): void {
  app.post('/api/integrations/execute', async (req, res) => {
    const integration = String(req.body?.integration || '') as IntegrationId;
    const operationId = String(req.body?.operation || '');

    const spec = resolveOperation(integration, operationId);
    if (!spec) {
      return res.status(400).json({
        error: operationId
          ? `Unknown operation "${operationId}" for "${integration}".`
          : `"${integration}" has no operations.`,
      });
    }

    // A requested-but-unknown operation is a bug worth reporting, not a silent
    // fallback to the default.
    if (operationId && !findOperation(integration, operationId)) {
      return res.status(400).json({ error: `Unknown operation "${operationId}" for "${integration}".` });
    }

    const config = mergedConfig<Record<string, any>>(integration, req.body?.config);

    // Gemini authorizes with a key; the rest report their own missing fields
    // through the transport, which gives a more specific message.
    const { valid, missing } = validateIntegrationConfig(integration, config);
    if (!valid) {
      return res.status(400).json({
        error: `${integration} is not configured yet: missing ${missing.join(', ')}.`,
        missing,
      });
    }

    try {
      const result = await runOperation({
        integration,
        operationId: spec.id,
        config,
        params: req.body?.params || {},
        rows: toRows(req.body?.rows ?? req.body?.input),
        googleToken: req.body?.accessToken,
      });

      res.json({
        integration,
        operation: result.operation,
        direction: spec.direction,
        rows: result.rows ?? [],
        count: (result.rows ?? []).length,
        data: result.data ?? null,
        text: result.text ?? null,
        meta: result.meta ?? null,
        ranAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const status = err instanceof UpstreamError ? err.status : 400;
      console.error(`Operation ${integration}/${spec.id} failed:`, err?.message || err);
      res.status(status).json({ error: err?.message || `${spec.label} failed.` });
    }
  });

  /** The operation catalog, so a client can discover what is callable. */
  app.get('/api/integrations/operations', (req, res) => {
    const integration = String(req.query?.integration || '') as IntegrationId;
    const spec = resolveOperation(integration, undefined);
    if (!spec) return res.status(400).json({ error: `"${integration}" has no operations.` });

    res.json({
      integration,
      operations: operationsFor(integration),
    });
  });
}
