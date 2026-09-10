/**
 * Mermaid flowcharts in and out of the canvas.
 *
 * Import is deliberately forgiving: a diagram pasted from a doc or an LLM is a
 * sketch of intent, not a serialised graph. Every node it names becomes a real
 * node — mapped onto an integration when the label says which one, and onto a
 * note when it plainly is one — so the result is a workflow to finish rather
 * than a picture to retype.
 */

import { Edge, Node } from '@xyflow/react';
import { IntegrationId } from './integrationCore';
import { defaultOperationFor } from './operations';
import { nodeTypeForIntegration } from '../components/nodes/appNodes';
import { centerLayout } from './defaultWorkflow';

export interface MermaidParseResult {
  nodes: Node[];
  edges: Edge[];
  /** Non-fatal things worth telling the user about the import. */
  warnings: string[];
}

/** Words in a node's label that identify which integration it means. */
const INTEGRATION_HINTS: { match: RegExp; integration: IntegrationId }[] = [
  { match: /\b(google\s*)?sheets?\b|\bspreadsheet\b/i, integration: 'sheets' },
  { match: /\bkeepa\b|\basins?\b/i, integration: 'keepa' },
  { match: /\basana\b/i, integration: 'asana' },
  { match: /\bsupabase\b|\bpostgres\b/i, integration: 'supabase' },
  { match: /\b(google\s*)?drive\b/i, integration: 'drive' },
  { match: /\bgithub\b/i, integration: 'github' },
  { match: /\bopenrouter\b/i, integration: 'openrouter' },
  { match: /\bhugging\s*face\b/i, integration: 'huggingface' },
  { match: /\bopencode\b/i, integration: 'opencode' },
  { match: /\bmcp\b/i, integration: 'mcp' },
  { match: /\bgemini\b|\bllm\b|\bai\b/i, integration: 'gemini' },
  { match: /\bhttps?\b|\bhttp\b|\bapi\b|\bwebhook\b/i, integration: 'http' },
];

/** Labels that mean a non-integration node type. */
const PLAIN_HINTS: { match: RegExp; type: string }[] = [
  { match: /\btrigger\b|\bstart\b|\bbegin\b|\bcron\b|\bschedule\b/i, type: 'trigger' },
  { match: /\bscript\b|\bcode\b|\btransform\b|\brank\b|\bsort\b|\bfilter\b|\bmap\b|\bcompute\b/i, type: 'script' },
  { match: /\bnote\b|\bcomment\b|\btodo\b/i, type: 'sticky' },
];

/**
 * Node declarations. Mermaid gives each shape its own brackets; the capture is
 * the label either way. Ordered longest-delimiter-first so `[(`, `[[` and `((`
 * are not mistaken for a bare `[` or `(`.
 */
const NODE_SHAPES: RegExp[] = [
  /([A-Za-z0-9_-]+)\s*\[\[([^\]]*)\]\]/g,
  /([A-Za-z0-9_-]+)\s*\[\(([^)]*)\)\]/g,
  /([A-Za-z0-9_-]+)\s*\(\(([^)]*)\)\)/g,
  /([A-Za-z0-9_-]+)\s*\{\{([^}]*)\}\}/g,
  /([A-Za-z0-9_-]+)\s*\[\/([^\]]*)\/\]/g,
  /([A-Za-z0-9_-]+)\s*\[([^\]]*)\]/g,
  /([A-Za-z0-9_-]+)\s*\(([^)]*)\)/g,
  /([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g,
  /([A-Za-z0-9_-]+)\s*>([^\]]*)\]/g,
];

/** `A --> B`, `A-->|label|B`, `A === B`, `A -.-> B`, and the rest. */
const EDGE_PATTERN =
  /([A-Za-z0-9_-]+)\s*(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*(?:--+|-\.-*|==+)[->.]*>?\s*(?:\|([^|]*)\|)?\s*([A-Za-z0-9_-]+)/g;

function stripQuotes(label: string): string {
  return label.trim().replace(/^["'`]|["'`]$/g, '').replace(/<br\s*\/?>/gi, ' ').trim();
}

/** The node type a label implies, or a plain note when nothing matches. */
function classify(label: string): { type: string; integration?: IntegrationId } {
  for (const hint of PLAIN_HINTS) {
    if (hint.match.test(label)) return { type: hint.type };
  }
  for (const hint of INTEGRATION_HINTS) {
    if (hint.match.test(label)) {
      const type = nodeTypeForIntegration(hint.integration);
      if (type) return { type, integration: hint.integration };
    }
  }
  return { type: 'sticky' };
}

function buildNodeData(label: string, type: string, integration?: IntegrationId): Record<string, any> {
  if (integration) {
    return { title: label, operation: defaultOperationFor(integration), params: {} };
  }
  if (type === 'sticky') return { title: label, text: label, tone: 'blue' };
  if (type === 'script') return { title: label, script: '// ' + label + '\nreturn input;' };
  return { title: label };
}

/**
 * Lays the graph out in dependency order: each node one column right of its
 * furthest-upstream parent, siblings stacked. Mermaid carries no coordinates,
 * so something has to decide, and left-to-right by depth matches how the rest
 * of the canvas reads.
 */
function layout(ids: string[], edges: { from: string; to: string }[]): Record<string, { x: number; y: number }> {
  const depth: Record<string, number> = {};
  ids.forEach((id) => (depth[id] = 0));

  // Relaxation rather than a topological sort, so a cyclic diagram still
  // lays out instead of throwing. Bounded by the node count.
  for (let pass = 0; pass < ids.length; pass += 1) {
    let moved = false;
    edges.forEach(({ from, to }) => {
      if (depth[to] < depth[from] + 1) {
        depth[to] = depth[from] + 1;
        moved = true;
      }
    });
    if (!moved) break;
  }

  const perColumn: Record<number, number> = {};
  const positions: Record<string, { x: number; y: number }> = {};
  ids.forEach((id) => {
    const column = depth[id] ?? 0;
    const row = perColumn[column] ?? 0;
    perColumn[column] = row + 1;
    positions[id] = { x: column * 420, y: row * 260 };
  });

  return positions;
}

export function looksLikeMermaid(text: string): boolean {
  return /^\s*(flowchart|graph)\s+(TB|TD|BT|RL|LR)\b/im.test(text);
}

/** Parses a mermaid flowchart into canvas nodes and edges. */
export function parseMermaid(source: string): MermaidParseResult {
  const warnings: string[] = [];
  const text = String(source || '').replace(/```mermaid|```/g, '');

  if (!looksLikeMermaid(text)) {
    throw new Error('That does not look like a mermaid flowchart. It should start with "flowchart TD" or "graph LR".');
  }

  const body = text
    .split('\n')
    .filter((line) => !/^\s*(flowchart|graph)\s+\w+/i.test(line))
    .filter((line) => !/^\s*(%%|click |style |classDef |linkStyle |subgraph|end\b)/i.test(line))
    .join('\n');

  const labels = new Map<string, string>();
  let remaining = body;
  NODE_SHAPES.forEach((pattern) => {
    remaining = remaining.replace(new RegExp(pattern.source, 'g'), (_match, id: string, label: string) => {
      if (!labels.has(id)) labels.set(id, stripQuotes(label) || id);
      // Leave the bare id behind so the edge pass still sees the connection.
      return ' ' + id + ' ';
    });
  });

  const links: { from: string; to: string; label?: string }[] = [];
  const edgePattern = new RegExp(EDGE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = edgePattern.exec(remaining)) !== null) {
    const [, from, label, to] = match;
    links.push({ from, to, label: label ? stripQuotes(label) : undefined });
    if (!labels.has(from)) labels.set(from, from);
    if (!labels.has(to)) labels.set(to, to);
    // Chains like A --> B --> C overlap, so step back to catch the next pair.
    edgePattern.lastIndex = match.index + match[0].length - to.length;
  }

  if (labels.size === 0) throw new Error('No nodes found in that diagram.');
  if (links.length === 0) warnings.push('No connections were found, so the nodes were placed unlinked.');

  // Shapes are matched one pattern at a time, so `C[(Supabase)]` is seen
  // before a plain `A[Trigger]` further up the diagram. Re-order by where each
  // id actually appears, so the import reads in the order it was written.
  const appearance = new Map<string, number>();
  (body.match(/[A-Za-z0-9_-]+/g) ?? []).forEach((token, index) => {
    if (!appearance.has(token)) appearance.set(token, index);
  });
  const ids = [...labels.keys()].sort(
    (a, b) => (appearance.get(a) ?? Number.MAX_SAFE_INTEGER) - (appearance.get(b) ?? Number.MAX_SAFE_INTEGER)
  );

  const positions = layout(ids, links);

  const nodes: Node[] = ids.map((id) => {
    const label = labels.get(id) as string;
    const { type, integration } = classify(label);
    if (!integration && type === 'sticky') {
      warnings.push(`"${label}" did not name an app, so it came in as a note.`);
    }
    return {
      id: `mmd-${id}`,
      type,
      position: positions[id],
      data: buildNodeData(label, type, integration),
    };
  });

  const seen = new Set<string>();
  const edges: Edge[] = links
    .filter(({ from, to }) => {
      const key = `${from}->${to}`;
      if (seen.has(key) || from === to) return false;
      seen.add(key);
      return true;
    })
    .map(({ from, to, label }) => ({
      id: `mmd-${from}-${to}`,
      source: `mmd-${from}`,
      target: `mmd-${to}`,
      // These node types expose only id'd handles; an edge naming none is
      // accepted into state and then never drawn.
      sourceHandle: 'right',
      targetHandle: 'left',
      label,
    }));

  // Notes are annotation and cannot join the graph, so drop edges touching one.
  const noteIds = new Set(nodes.filter((node) => node.type === 'sticky').map((node) => node.id));
  const wired = edges.filter((edge) => !noteIds.has(edge.source) && !noteIds.has(edge.target));
  if (wired.length !== edges.length) {
    warnings.push('Connections to notes were dropped; notes are annotation, not steps.');
  }

  return { nodes: centerLayout(nodes), edges: wired, warnings };
}

/** Renders the current graph as a mermaid flowchart. */
export function toMermaid(nodes: Node[], edges: Edge[]): string {
  const safe = (id: string) => id.replace(/[^A-Za-z0-9_]/g, '_');
  const lines = ['flowchart LR'];

  nodes
    .filter((node) => node.type !== 'sticky')
    .forEach((node) => {
      const title = String((node.data as any)?.title || node.type || node.id).replace(/["\n]/g, ' ');
      const operation = (node.data as any)?.operation;
      const label = operation ? `${title}<br/>${operation}` : title;
      lines.push(`    ${safe(node.id)}["${label}"]`);
    });

  edges.forEach((edge) => {
    const label = edge.label ? `|${String(edge.label).replace(/["|\n]/g, ' ')}|` : '';
    lines.push(`    ${safe(edge.source)} -->${label} ${safe(edge.target)}`);
  });

  return lines.join('\n');
}
