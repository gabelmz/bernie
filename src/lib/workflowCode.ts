/**
 * The workflow, written out as the code that runs it.
 *
 * This is a rendering of the real execution, not a sketch of one: the order is
 * the order the canvas propagates in, each app node becomes the
 * `/api/integrations/execute` call it actually makes with the operation and
 * params it actually carries, and each script node's body is the body that is
 * actually evaluated. If the generated code and the run disagree, the
 * generator is wrong.
 */

import { Edge, Node } from '@xyflow/react';
import { APP_NODE_STYLES } from '../components/nodes/appNodes';

/** Node types that are annotation and never execute. */
const NON_EXECUTING = new Set(['sticky', 'text', 'json']);

function identifier(node: Node, taken: Set<string>): string {
  const base =
    String((node.data as any)?.title || node.type || node.id)
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map((word, index) => (index === 0 ? word.toLowerCase() : word[0]?.toUpperCase() + word.slice(1).toLowerCase()))
      .join('') || 'step';

  let name = /^[0-9]/.test(base) ? `step${base}` : base;
  let suffix = 2;
  while (taken.has(name)) name = `${base}${suffix++}`;
  taken.add(name);
  return name;
}

/**
 * Execution order. The canvas runs a node when a parent hands it data, so this
 * is a breadth-first walk from the entry nodes — and a node with two parents
 * appears once, at the point it first becomes reachable, which is exactly the
 * "last writer wins" behaviour the canvas has (see SPINE.md).
 */
export function executionOrder(nodes: Node[], edges: Edge[]): Node[] {
  const runnable = nodes.filter((node) => !NON_EXECUTING.has(String(node.type)));
  const ids = new Set(runnable.map((node) => node.id));
  const links = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));

  const incoming = new Map<string, number>();
  runnable.forEach((node) => incoming.set(node.id, 0));
  links.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1));

  const queue = runnable.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  const seen = new Set<string>(queue);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    links
      .filter((edge) => edge.source === id)
      .forEach((edge) => {
        if (seen.has(edge.target)) return;
        seen.add(edge.target);
        queue.push(edge.target);
      });
  }

  // A cycle leaves nodes unvisited; show them rather than silently dropping.
  runnable.forEach((node) => {
    if (!seen.has(node.id)) order.push(node.id);
  });

  const byId = new Map(runnable.map((node) => [node.id, node]));
  return order.map((id) => byId.get(id) as Node).filter(Boolean);
}

function literal(value: any): string {
  return JSON.stringify(value ?? null, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : '  ' + line))
    .join('\n');
}

function indent(body: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return body
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

export interface CodeGenOptions {
  /** Name used for the exported function. */
  name?: string;
}

export function generateWorkflowCode(nodes: Node[], edges: Edge[], options: CodeGenOptions = {}): string {
  const ordered = executionOrder(nodes, edges);
  const notes = nodes.filter((node) => String(node.type) === 'sticky');

  if (ordered.length === 0) {
    return '// Nothing to run yet. Drop a node on the canvas.\n';
  }

  const names = new Map<string, string>();
  const taken = new Set<string>(['input', 'run', 'execute']);
  ordered.forEach((node) => names.set(node.id, identifier(node, taken)));

  const parentOf = (id: string): string | null => {
    // The canvas overwrites inputData per delivery, so the effective input is
    // the last parent to run. Mirror that rather than pretending it merges.
    const parents = edges.filter((edge) => edge.target === id).map((edge) => edge.source);
    const runnable = parents.filter((parent) => names.has(parent));
    return runnable.length > 0 ? (runnable[runnable.length - 1] as string) : null;
  };

  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * ${options.name || 'Workflow'} — generated from the canvas.`);
  lines.push(' *');
  lines.push(' * Every app node is one POST /api/integrations/execute. Script nodes run');
  lines.push(' * their own body. The order below is the order the canvas runs in.');
  lines.push(' */');
  lines.push('');

  notes.forEach((note) => {
    const text = String((note.data as any)?.text || '').trim();
    if (text) {
      lines.push(...text.split('\n').map((line) => `// note: ${line}`));
    }
  });
  if (notes.length > 0) lines.push('');

  lines.push('async function execute(integration, operation, params, rows, credentials) {');
  lines.push("  const response = await fetch('/api/integrations/execute', {");
  lines.push("    method: 'POST',");
  lines.push("    headers: { 'Content-Type': 'application/json' },");
  lines.push('    body: JSON.stringify({ integration, operation, params, rows, config: credentials }),');
  lines.push('  });');
  lines.push('');
  lines.push('  const result = await response.json();');
  lines.push('  if (!response.ok) throw new Error(result.error);');
  lines.push('  return result.rows ?? [];');
  lines.push('}');
  lines.push('');
  const entry = options.name
    ? identifier({ id: 'entry', data: { title: options.name } } as unknown as Node, new Set<string>())
    : 'runWorkflow';
  lines.push(`export async function ${entry}() {`);

  let hasRows = false;

  ordered.forEach((node) => {
    const name = names.get(node.id) as string;
    const data = (node.data as any) || {};
    const title = String(data.title || node.type);
    const parent = parentOf(node.id);
    const source = parent ? (names.get(parent) as string) : null;

    lines.push('');
    lines.push(`  // ${title}`);

    if (String(node.type) === 'trigger') {
      lines.push(`  // entry point — nothing runs until this fires`);
      lines.push(`  const ${name} = [];`);
      hasRows = true;
      return;
    }

    if (String(node.type) === 'script') {
      const body = String(data.script || 'return input;');
      lines.push(`  const ${name} = (function (input) {`);
      lines.push(indent(body, 4));
      lines.push(`  })(${source ?? '[]'});`);
      hasRows = true;
      return;
    }

    const style = APP_NODE_STYLES[String(node.type)];
    if (style) {
      const params = data.params && Object.keys(data.params).length > 0 ? literal(data.params) : '{}';
      const credentials = data.credentials && Object.keys(data.credentials).length > 0 ? '/* node credentials */ {}' : '{}';
      lines.push(`  const ${name} = await execute(`);
      lines.push(`    '${style.integration}',`);
      lines.push(`    '${data.operation || '(default operation)'}',`);
      lines.push(`    ${params},`);
      lines.push(`    ${source ?? '[]'},`);
      lines.push(`    ${credentials},`);
      lines.push('  );');
      hasRows = true;
      return;
    }

    lines.push(`  // ${node.type} node — runs in the browser, not through the API`);
    lines.push(`  const ${name} = ${source ?? '[]'};`);
    hasRows = true;
  });

  const last = ordered[ordered.length - 1];
  lines.push('');
  lines.push(`  return ${hasRows && last ? names.get(last.id) : '[]'};`);
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}
