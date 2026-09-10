/**
 * The single entry point every app-scoped node calls:
 *   POST /api/integrations/execute
 *   { integration, operation, config, params, rows, accessToken }
 *
 * `config` arrives already merged in the browser (node credentials over the
 * saved connection), and env vars fill any remaining gaps server-side.
 */

import type { Express } from 'express';
import { IntegrationId } from '../lib/integrationCore';
import { operationsFor, resolveOperation } from '../lib/operations';
import { executeOperation } from './executeCore';
import { geminiFor } from './integrationKit';

export function registerExecuteRoute(app: Express): void {
  app.post('/api/integrations/execute', async (req, res) => {
    // The Worker serves the same route from the same core; this is only the
    // Express wrapper around it, plus the Node-backed Gemini client.
    const outcome = await executeOperation(req.body, {
      gemini: (config) => {
        const resolved = geminiFor(config);
        if (!resolved) return null;
        return {
          model: resolved.model,
          generateContent: (request) => resolved.client.models.generateContent(request) as any,
        };
      },
    });

    if (outcome.status >= 400) {
      console.error(`Operation ${req.body?.integration}/${req.body?.operation} failed:`, outcome.body.error);
    }
    res.status(outcome.status).json(outcome.body);
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
