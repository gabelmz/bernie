import { describe, it, expect } from 'vitest';
import { executionOrder, generateWorkflowCode } from '@/lib/workflowCode';
import { createDefaultWorkflow } from '@/lib/defaultWorkflow';
import { serializeGraph } from '@/lib/workflowStore';

const { nodes, edges } = createDefaultWorkflow();

describe('Execution order', () => {
  it('follows the graph from the trigger down', () => {
    const order = executionOrder(nodes, edges).map((node) => node.id);

    expect(order[0]).toBe('trigger');
    expect(order.indexOf('keepa-enrich')).toBeGreaterThan(order.indexOf('issues-pull'));
    expect(order.indexOf('asana-tasks')).toBeGreaterThan(order.indexOf('top-issues'));
  });

  it('leaves notes out — they never run', () => {
    const withNote = [
      ...nodes,
      { id: 'note', type: 'sticky', position: { x: 0, y: 0 }, data: { text: 'hi' } },
    ] as any;

    expect(executionOrder(withNote, edges).some((node) => node.id === 'note')).toBe(false);
  });

  it('still lists every node when the graph has a cycle', () => {
    const cyclic = [
      { id: 'a', type: 'script', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', type: 'script', position: { x: 0, y: 0 }, data: {} },
    ] as any;
    const loop = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ] as any;

    expect(executionOrder(cyclic, loop)).toHaveLength(2);
  });
});

describe('Generated code', () => {
  const code = generateWorkflowCode(nodes, edges);

  it('is valid JavaScript', () => {
    // The point of the view is that this is what runs, so it has to parse.
    expect(() => new Function(code.replace(/export\s+/g, ''))).not.toThrow();
  });

  it('shows the real operation each app node calls', () => {
    expect(code).toContain("'sheets',");
    expect(code).toContain("'values.pull'");
    expect(code).toContain("'keepa',");
    expect(code).toContain("'product.lookup'");
    expect(code).toContain("'asana',");
    expect(code).toContain("'tasks.create'");
  });

  it('carries the params the node actually holds', () => {
    expect(code).toContain('"range": "Issues"');
    expect(code).toContain('"mergeInputRows": true');
  });

  it('inlines a script node body rather than describing it', () => {
    expect(code).toContain('issue_score');
    expect(code).toContain('slice(0, 10)');
  });

  it('threads each step into the next', () => {
    // The Keepa call receives the rows the Sheets pull returned.
    expect(code).toMatch(/asinIssuesSheet[\s\S]*keepaProductData/);
  });

  it('names notes as comments, since they are not steps', () => {
    const annotated = [
      ...nodes,
      { id: 'note', type: 'sticky', position: { x: 0, y: 0 }, data: { text: 'check the tab name' } },
    ] as any;

    expect(generateWorkflowCode(annotated, edges)).toContain('// note: check the tab name');
  });

  it('says so plainly when there is nothing to run', () => {
    expect(generateWorkflowCode([], [])).toContain('Nothing to run yet');
  });
});

describe('Serialising a graph for storage', () => {
  it('drops callbacks and live run state', () => {
    const live = [
      {
        id: 'a',
        type: 'sheet',
        position: { x: 0, y: 0 },
        data: {
          title: 'Sheet',
          operation: 'values.pull',
          onDataFetched: () => {},
          runWorkflow: () => {},
          status: 'running',
          inputData: [{ asin: 'B1' }],
        },
      },
    ] as any;

    const [node] = serializeGraph(live, []).nodes;
    const data = node.data as any;

    expect(data.onDataFetched).toBeUndefined();
    expect(data.runWorkflow).toBeUndefined();
    expect(data.status).toBeUndefined();
    expect(data.inputData).toBeUndefined();
    expect(data.operation).toBe('values.pull');
  });

  it('survives a JSON round trip, which is how it is stored', () => {
    const graph = serializeGraph(nodes, edges);
    const again = JSON.parse(JSON.stringify(graph));

    expect(again.nodes).toHaveLength(nodes.length);
    expect(again.edges).toHaveLength(edges.length);
    expect(again.nodes[0].position).toEqual(nodes[0].position);
  });
});
