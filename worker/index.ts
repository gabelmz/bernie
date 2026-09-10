/**
 * The Bernie API as a Cloudflare Worker.
 *
 * Two responsibilities:
 *   - Saved workflows in D1 (`/api/workflows`).
 *   - `/api/integrations/execute`, sharing `executeCore` with the Express dev
 *     server. A statically hosted front end (AI Studio, a built dist/, Pages)
 *     has no Express process, so every POST to /api/* comes back 405. Pointing
 *     VITE_API_BASE_URL at this Worker gives those builds a real API.
 *
 * CORS is open because the front end is served from a different origin than
 * this Worker in every deployment that needs it. Credentials still travel in
 * the request body exactly as they do to the Express server — this Worker adds
 * no new trust, and inherits that design's problems (see TODO.md).
 */

import { executeOperation } from '../src/server/executeCore';
import { GeminiClient } from '../src/server/operationRunner';

export interface Env {
  DB: D1Database;
  [key: string]: unknown;
}

interface SavedWorkflow {
  id: string;
  name: string;
  description: string;
  graph: { nodes: unknown[]; edges: unknown[] };
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/**
 * Who the row belongs to. The browser sends its Supabase access token; the
 * subject claim is read without verifying the signature, which is enough to
 * keep one person's list separate from another's but is NOT access control —
 * anyone can mint a token with any `sub`. Verifying it against the project's
 * JWKS is the follow-up, tracked in TODO.md.
 */
function ownerFrom(request: Request): string {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return 'anonymous';

  const payload = token.split('.')[1];
  if (!payload) return 'anonymous';

  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
    return String(claims?.sub || 'anonymous');
  } catch {
    return 'anonymous';
  }
}

/** Rejects a graph that is not the shape the canvas can load back. */
function readWorkflow(body: any): { workflow: SavedWorkflow } | { error: string } {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'A workflow needs a name.' };

  const nodes = body?.graph?.nodes ?? body?.nodes;
  const edges = body?.graph?.edges ?? body?.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return { error: 'A workflow needs a graph with nodes and edges arrays.' };
  }

  return {
    workflow: {
      id: String(body?.id || crypto.randomUUID()),
      name,
      description: String(body?.description || '').trim(),
      graph: { nodes, edges },
    },
  };
}

function rowToWorkflow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    graph: row.graph ? JSON.parse(row.graph) : undefined,
  };
}

async function handleWorkflows(request: Request, env: Env, id: string | null): Promise<Response> {
  const owner = ownerFrom(request);

  if (request.method === 'GET' && !id) {
    const { results } = await env.DB.prepare(
      'SELECT id, name, description, node_count, edge_count, created_at, updated_at' +
        ' FROM workflows WHERE owner = ? ORDER BY updated_at DESC LIMIT 100'
    )
      .bind(owner)
      .all();
    return json({ workflows: (results ?? []).map(rowToWorkflow) });
  }

  if (request.method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM workflows WHERE id = ? AND owner = ?')
      .bind(id, owner)
      .first();
    if (!row) return json({ error: 'No workflow with that id.' }, 404);
    return json({ workflow: rowToWorkflow(row) });
  }

  if (request.method === 'POST' || request.method === 'PUT') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Body was not valid JSON.' }, 400);
    }

    const parsed = readWorkflow(id ? { ...(body as object), id } : body);
    if ('error' in parsed) return json({ error: parsed.error }, 400);

    const { workflow } = parsed;
    const now = new Date().toISOString();
    const graph = JSON.stringify(workflow.graph);

    // Upsert, so "save" is one call whether or not the workflow existed. The
    // owner is fixed at insert and never rewritten, and the WHERE on the
    // update means a second person cannot take over a row by saving over its
    // id — the write simply affects nothing and the read-back returns 403.
    await env.DB.prepare(
      'INSERT INTO workflows (id, name, description, owner, graph, node_count, edge_count, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)' +
        ' ON CONFLICT(id) DO UPDATE SET' +
        '   name = excluded.name,' +
        '   description = excluded.description,' +
        '   graph = excluded.graph,' +
        '   node_count = excluded.node_count,' +
        '   edge_count = excluded.edge_count,' +
        '   updated_at = excluded.updated_at' +
        ' WHERE workflows.owner = excluded.owner'
    )
      .bind(
        workflow.id,
        workflow.name,
        workflow.description,
        owner,
        graph,
        workflow.graph.nodes.length,
        workflow.graph.edges.length,
        now,
        now
      )
      .run();

    const saved = await env.DB.prepare(
      'SELECT id, name, description, node_count, edge_count, created_at, updated_at' +
        ' FROM workflows WHERE id = ? AND owner = ?'
    )
      .bind(workflow.id, owner)
      .first();

    if (!saved) return json({ error: 'That workflow id belongs to someone else.' }, 403);
    return json({ workflow: rowToWorkflow(saved) }, 200);
  }

  if (request.method === 'DELETE' && id) {
    const result = await env.DB.prepare('DELETE FROM workflows WHERE id = ? AND owner = ?')
      .bind(id, owner)
      .run();
    if (!(result.meta?.changes ?? 0)) return json({ error: 'No workflow with that id.' }, 404);
    return json({ deleted: id });
  }

  return json({ error: request.method + ' is not supported here.' }, 405);
}

/**
 * The Gemini SDK is Node-only, so the Worker talks to the REST API instead and
 * hands the runner the same small interface the SDK adapter satisfies.
 */
function geminiOverRest(env: Env): (config: any) => GeminiClient | null {
  return (config: any) => {
    const apiKey = String(config?.apiKey || env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return null;

    const model = String(config?.model || env.GEMINI_MODEL || 'gemini-3.1-pro-preview').trim();

    return {
      model,
      async generateContent(request) {
        const target =
          'https://generativelanguage.googleapis.com/v1beta/models/' +
          encodeURIComponent(request.model || model) +
          ':generateContent';

        const response = await fetch(target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: request.contents }] }],
            generationConfig: request.config?.responseMimeType
              ? { responseMimeType: request.config.responseMimeType }
              : undefined,
          }),
        });

        const payload: any = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message || 'Gemini failed (' + response.status + ').');
        }

        const parts = payload?.candidates?.[0]?.content?.parts;
        const text = Array.isArray(parts) ? parts.map((part: any) => part?.text ?? '').join('') : null;
        return { text };
      },
    };
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/api/health') {
      return json({ ok: true, service: 'bernie-api', at: new Date().toISOString() });
    }

    if (path === '/api/workflows' || path.startsWith('/api/workflows/')) {
      const id = path === '/api/workflows' ? null : decodeURIComponent(path.slice('/api/workflows/'.length));
      try {
        return await handleWorkflows(request, env, id || null);
      } catch (err: any) {
        return json({ error: err?.message || 'The workflow store failed.' }, 500);
      }
    }

    if (path === '/api/integrations/execute') {
      if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

      let payload: any;
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'Body was not valid JSON.' }, 400);
      }

      const outcome = await executeOperation(payload, {
        env: env as Record<string, unknown>,
        gemini: geminiOverRest(env),
      });
      return json(outcome.body, outcome.status);
    }

    return json({ error: 'No route for ' + path + '.' }, 404);
  },
};
