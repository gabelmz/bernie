/**
 * Saved workflows, backed by the Cloudflare Worker's D1 database.
 *
 * `bernie-autosave` in localStorage stays what it was: a per-browser scratch
 * buffer for whatever is on the canvas right now. This is the deliberate act
 * of keeping one — named, listable, and reachable from another machine.
 */

import { Edge, Node } from '@xyflow/react';
import { apiUrl, describeApiFailure } from './apiBase';
import { getSession } from './auth';

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedWorkflow extends WorkflowSummary {
  graph?: { nodes: Node[]; edges: Edge[] };
}

/**
 * Callbacks and live run state live on node data and must not be persisted:
 * functions do not survive JSON, and a node saved mid-run would come back
 * still claiming to be running.
 */
const TRANSIENT_NODE_FIELDS = [
  'onDataFetched',
  'runWorkflow',
  'status',
  'errorMessage',
  'inputData',
  'lastRunMeta',
  'lastRunCount',
];

export function serializeGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((node) => {
      const data: Record<string, any> = { ...(node.data as any) };
      TRANSIENT_NODE_FIELDS.forEach((field) => delete data[field]);
      return { ...node, data, selected: false, dragging: false };
    }),
    edges: edges.map((edge) => ({ ...edge, selected: false })),
  };
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    // The Supabase session token, whose `sub` is the user id the Worker scopes
    // rows by. Deliberately not getAccessToken(): that returns the *Google*
    // provider token, which is for googleapis.com and carries a different
    // subject. Signed out, rows are saved as 'anonymous' — worth knowing, not
    // worth blocking on, since the canvas works signed out too.
    const session = getSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  } catch {
    // Treated as signed out.
  }
  return headers;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), { ...init, headers: authHeaders() });

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) throw new Error(payload?.error || describeApiFailure(path, response.status));
  return payload as T;
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const payload = await call<{ workflows: WorkflowSummary[] }>('/api/workflows');
  return payload.workflows ?? [];
}

export async function loadWorkflow(id: string): Promise<SavedWorkflow> {
  const payload = await call<{ workflow: SavedWorkflow }>(`/api/workflows/${encodeURIComponent(id)}`);
  return payload.workflow;
}

export async function saveWorkflow(input: {
  id?: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
}): Promise<WorkflowSummary> {
  const payload = await call<{ workflow: WorkflowSummary }>('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      description: input.description ?? '',
      graph: serializeGraph(input.nodes, input.edges),
    }),
  });
  return payload.workflow;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await call(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
