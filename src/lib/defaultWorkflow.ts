/**
 * The workflow a fresh canvas opens with: pull the ASIN issue list out of a
 * Google Sheet, enrich each ASIN from Keepa, rank the issues by the revenue
 * they put at risk, write the ranking back to the sheet, and open Asana tasks
 * for the worst ten.
 *
 * It is a real, runnable graph rather than a demo — every node is wired to the
 * operation it needs, so the only thing left is connecting the three accounts
 * under Connections & APIs and pointing the Sheets nodes at a spreadsheet.
 */

import { Edge, Node } from '@xyflow/react';

/** Tab the issue list is read from and the ranking is written back to. */
export const ISSUES_RANGE = 'Issues';

/**
 * Columns the workflow expects on that tab. `asin` is the only required one —
 * it is what Keepa is looked up by; `issue` becomes the Asana task title.
 */
export const ISSUE_SHEET_COLUMNS = ['asin', 'issue'];

/**
 * Ranks the issues. Sold-last-month carries more weight than sales rank
 * because it is the closer proxy for revenue at risk, and both are normalised
 * to 0-1 first so the stated 60/40 split is the real one.
 */
const RANK_SCRIPT = `// Input: one row per ASIN issue, enriched with Keepa fields.
// Output: the same rows, scored and sorted worst-problem-first.
const rows = Array.isArray(input) ? input : (input && input.rows) || [];
const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const scored = rows.map((row) => {
  const sold = num(row.monthly_sold);
  const rank = num(row.sales_rank);

  // 10k units a month saturates the scale. No data scores 0, never best.
  const soldScore = sold === null ? 0 : Math.min(1, Math.log10(sold + 1) / 4);
  // Rank 1 is the best seller; 10 million is effectively unranked.
  const rankScore = rank === null ? 0 : Math.min(1, Math.max(0, 1 - Math.log10(rank) / 7));

  return { ...row, issue_score: Math.round((soldScore * 60 + rankScore * 40) * 10) / 10 };
});

scored.sort((a, b) => b.issue_score - a.issue_score);
return scored.map((row, index) => ({ ...row, issue_priority: index + 1 }));`;

/**
 * Cuts the ranked list to ten and reshapes it into Asana task fields. Asana
 * reads row keys as fields, so `name` and `notes` are the contract here.
 */
const TOP_TASKS_SCRIPT = `// Input: the ranked rows. Output: at most 10 Asana task rows.
const rows = Array.isArray(input) ? input : (input && input.rows) || [];
const shown = (value) => (value === null || value === undefined || value === '' ? 'no data' : value);

return rows.slice(0, 10).map((row) => ({
  name: '[' + (row.asin || 'ASIN') + '] ' + (row.issue || row.title || 'Listing issue'),
  notes: [
    'ASIN: ' + shown(row.asin),
    'Issue: ' + shown(row.issue),
    'Priority: #' + row.issue_priority + ' of ' + rows.length + ' (score ' + row.issue_score + ')',
    'Sales rank: ' + shown(row.sales_rank),
    'Sold last month: ' + shown(row.monthly_sold),
    row.title ? 'Product: ' + row.title : '',
  ].filter(Boolean).join('\\n'),
}));`;

/** Ids are stable and readable so a saved canvas stays diffable. */
export const defaultWorkflowNodes: Node[] = [
  {
    id: 'trigger',
    type: 'trigger',
    position: { x: 40, y: 300 },
    data: { title: 'Run ASIN Issue Triage' },
  },
  {
    id: 'issues-pull',
    type: 'sheet',
    position: { x: 340, y: 250 },
    data: {
      title: 'ASIN Issues (Sheet)',
      operation: 'values.pull',
      params: { range: ISSUES_RANGE, headerRow: true },
    },
  },
  {
    id: 'keepa-enrich',
    type: 'keepa',
    position: { x: 760, y: 250 },
    data: {
      title: 'Keepa Product Data',
      operation: 'product.lookup',
      // ASINs come from the rows above; merging keeps the issue text with them.
      params: { stats: 30, mergeInputRows: true },
    },
  },
  {
    id: 'rank-issues',
    type: 'script',
    position: { x: 1180, y: 250 },
    data: { title: 'Rank Issues', script: RANK_SCRIPT },
  },
  {
    id: 'issues-write',
    type: 'sheet',
    position: { x: 1560, y: 60 },
    data: {
      title: 'Write Ranking Back',
      operation: 'values.update',
      // Same tab, same row count, so the overwrite leaves nothing stale.
      params: { range: `${ISSUES_RANGE}!A1`, includeHeaders: true },
    },
  },
  {
    id: 'top-issues',
    type: 'script',
    position: { x: 1560, y: 440 },
    data: { title: 'Top 10 → Tasks', script: TOP_TASKS_SCRIPT },
  },
  {
    id: 'asana-tasks',
    type: 'asana',
    position: { x: 1940, y: 440 },
    data: { title: 'Create Asana Tasks', operation: 'tasks.create', params: {} },
  },
];

/**
 * Every node type here exposes only id'd handles (top/left in, right/bottom
 * out) and no default one, so an edge that names neither cannot be resolved
 * and silently fails to render. The layout runs left to right, so each edge
 * leaves `right` and arrives at `left`.
 */
function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, sourceHandle: 'right', targetHandle: 'left' };
}

export const defaultWorkflowEdges: Edge[] = [
  edge('trigger-issues', 'trigger', 'issues-pull'),
  edge('issues-keepa', 'issues-pull', 'keepa-enrich'),
  edge('keepa-rank', 'keepa-enrich', 'rank-issues'),
  // The ranking fans out: the sheet gets every row, Asana only the worst ten.
  edge('rank-write', 'rank-issues', 'issues-write'),
  edge('rank-top', 'rank-issues', 'top-issues'),
  edge('top-asana', 'top-issues', 'asana-tasks'),
];

/**
 * The canvas origin. The camera opens here and the seeded graph is laid out
 * around it, so "where the workflow is" and "where the camera points" are the
 * same fact rather than two constants that drift apart.
 */
export const CANVAS_CENTER = { x: 0, y: 0 } as const;

/**
 * Nominal node extent used only to centre the layout. Nodes are measured for
 * real once they mount; this just has to be close enough that the graph looks
 * centred before that happens.
 */
const NOMINAL_NODE = { width: 360, height: 190 };

/**
 * Shifts a layout so the centre of its bounding box lands on CANVAS_CENTER.
 * Doing it here rather than hand-picking coordinates means adding a node to
 * the seed cannot quietly push the graph off centre.
 */
export function centerLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes;

  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + NOMINAL_NODE.width));
  const bottom = Math.max(...nodes.map((node) => node.position.y + NOMINAL_NODE.height));

  const dx = CANVAS_CENTER.x - (left + right) / 2;
  const dy = CANVAS_CENTER.y - (top + bottom) / 2;

  return nodes.map((node) => ({
    ...node,
    position: { x: Math.round(node.position.x + dx), y: Math.round(node.position.y + dy) },
  }));
}

/** A fresh copy, so the canvas never mutates the module-level seed. */
export function createDefaultWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const copies = defaultWorkflowNodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  }));

  return {
    nodes: centerLayout(copies),
    edges: defaultWorkflowEdges.map((edge) => ({ ...edge })),
  };
}
