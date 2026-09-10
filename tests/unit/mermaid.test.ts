import { describe, it, expect } from 'vitest';
import { looksLikeMermaid, parseMermaid, toMermaid } from '@/lib/mermaid';
import { createDefaultWorkflow } from '@/lib/defaultWorkflow';

describe('Recognising a mermaid flowchart', () => {
  it('accepts the flowchart and graph headers', () => {
    expect(looksLikeMermaid('flowchart TD\n A --> B')).toBe(true);
    expect(looksLikeMermaid('graph LR\n A --> B')).toBe(true);
  });

  it('rejects anything else, rather than importing nonsense', () => {
    expect(looksLikeMermaid('select * from users')).toBe(false);
    expect(parseMermaid.bind(null, 'not a diagram')).toThrow(/does not look like/);
  });
});

describe('Importing a flowchart', () => {
  const diagram = `flowchart LR
    A[Trigger] --> B[Google Sheets]
    B --> C[Keepa lookup]
    C --> D[Rank issues]
    D --> E[Asana]`;

  it('maps labels onto the app nodes they name', () => {
    const { nodes } = parseMermaid(diagram);
    const types = nodes.map((node) => node.type);

    expect(types).toEqual(['trigger', 'sheet', 'keepa', 'script', 'asana']);
  });

  it('gives every app node a real operation from the registry', () => {
    const { nodes } = parseMermaid(diagram);
    const sheet = nodes.find((node) => node.type === 'sheet');

    expect((sheet?.data as any).operation).toBe('values.pull');
    expect((nodes.find((n) => n.type === 'asana')?.data as any).operation).toBe('tasks.list');
  });

  it('wires the edges with handles the node types declare', () => {
    const { edges } = parseMermaid(diagram);

    expect(edges).toHaveLength(4);
    edges.forEach((edge) => {
      expect(edge.sourceHandle).toBe('right');
      expect(edge.targetHandle).toBe('left');
    });
  });

  it('handles chained links on one line', () => {
    const { edges } = parseMermaid('flowchart LR\n  A[Trigger] --> B[Sheets] --> C[Keepa]');
    expect(edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(['mmd-A->mmd-B', 'mmd-B->mmd-C']);
  });

  it('reads the other node shapes and edge styles', () => {
    const { nodes, edges } = parseMermaid(
      'flowchart TD\n  A((Trigger)) -.-> B{{Google Sheets}}\n  B ==> C[(Supabase)]'
    );

    expect(nodes.map((node) => node.type)).toEqual(['trigger', 'sheet', 'supabase']);
    expect(edges).toHaveLength(2);
  });

  it('keeps edge labels', () => {
    const { edges } = parseMermaid('flowchart LR\n  A[Trigger] -->|only new rows| B[Google Sheets]');
    expect(edges[0].label).toBe('only new rows');
  });

  it('turns an unrecognised label into a note and says so', () => {
    const { nodes, warnings } = parseMermaid('flowchart LR\n  A[Trigger] --> B[Do the thing]');
    const note = nodes.find((node) => node.type === 'sticky');

    expect(note).toBeDefined();
    expect(warnings.join(' ')).toContain('came in as a note');
  });

  it('never wires a note into the graph', () => {
    const { edges } = parseMermaid('flowchart LR\n  A[Trigger] --> B[Do the thing] --> C[Keepa]');
    expect(edges.every((edge) => !edge.source.includes('B') && !edge.target.includes('B'))).toBe(true);
  });

  it('ignores directives, comments and styling', () => {
    const { nodes } = parseMermaid(
      'flowchart LR\n  %% a comment\n  classDef big fill:#f00\n  A[Trigger] --> B[Keepa]\n  style A fill:#0f0'
    );
    expect(nodes).toHaveLength(2);
  });

  it('survives a cycle instead of hanging', () => {
    const { nodes, edges } = parseMermaid('flowchart LR\n  A[Trigger] --> B[Keepa]\n  B --> A');
    expect(nodes).toHaveLength(2);
    expect(edges).toHaveLength(2);
  });

  it('strips a fenced code block', () => {
    const { nodes } = parseMermaid('```mermaid\nflowchart LR\n  A[Trigger] --> B[Keepa]\n```');
    expect(nodes).toHaveLength(2);
  });

  it('centres what it imports on the canvas origin', () => {
    const { nodes } = parseMermaid(diagram);
    const xs = nodes.map((node) => node.position.x);
    const ys = nodes.map((node) => node.position.y);

    // Bounding box of the positions straddles the origin in both axes.
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(-Math.max(...xs) - 1);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0);
  });
});

describe('Exporting the canvas', () => {
  it('renders the seeded workflow as a flowchart', () => {
    const { nodes, edges } = createDefaultWorkflow();
    const mermaid = toMermaid(nodes, edges);

    expect(mermaid.split('\n')[0]).toBe('flowchart LR');
    expect(mermaid).toContain('ASIN Issues (Sheet)');
    expect(mermaid).toContain('values.pull');
    expect(mermaid).toContain('trigger --> issues_pull');
  });

  it('leaves notes out, since they are not steps', () => {
    const mermaid = toMermaid(
      [
        { id: 'a', type: 'trigger', position: { x: 0, y: 0 }, data: { title: 'Go' } },
        { id: 'n', type: 'sticky', position: { x: 0, y: 0 }, data: { text: 'remember this' } },
      ] as any,
      []
    );

    expect(mermaid).toContain('Go');
    expect(mermaid).not.toContain('remember this');
  });

  it('round-trips a graph back to the same shape', () => {
    const source = 'flowchart LR\n  A[Trigger] --> B[Google Sheets]\n  B --> C[Keepa]';
    const { nodes, edges } = parseMermaid(source);
    const again = parseMermaid(toMermaid(nodes, edges));

    expect(again.nodes.map((node) => node.type)).toEqual(nodes.map((node) => node.type));
    expect(again.edges).toHaveLength(edges.length);
  });
});
