import { describe, it, expect } from 'vitest';
import { createDefaultWorkflow, ISSUES_RANGE } from '@/lib/defaultWorkflow';
import { operationsFor } from '@/lib/operations';

const { nodes, edges } = createDefaultWorkflow();
const byId = (id: string) => nodes.find((node) => node.id === id)!;

/** Runs a node's script the way ScriptNode does, so the seed is tested as shipped. */
function runScript(nodeId: string, input: any): any {
  const script = String((byId(nodeId).data as any).script);
  return new Function('input', script)(input);
}

describe('The workflow a fresh canvas opens with', () => {
  it('wires the six steps end to end', () => {
    expect(nodes.map((node) => node.type)).toEqual([
      'trigger',
      'sheet',
      'keepa',
      'script',
      'sheet',
      'script',
      'asana',
    ]);

    expect(edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      'trigger->issues-pull',
      'issues-pull->keepa-enrich',
      'keepa-enrich->rank-issues',
      'rank-issues->issues-write',
      'rank-issues->top-issues',
      'top-issues->asana-tasks',
    ]);
  });

  it('names a handle on both ends of every edge', () => {
    // These node types expose no default handle, so an edge that names none
    // is accepted into state and then never drawn.
    edges.forEach((edge) => {
      expect(edge.sourceHandle, `${edge.id} source`).toBeTruthy();
      expect(edge.targetHandle, `${edge.id} target`).toBeTruthy();
    });
  });

  it('connects handles the node types actually declare', () => {
    const sources = new Set(['right', 'bottom']);
    const targets = new Set(['top', 'left']);

    edges.forEach((edge) => {
      expect(sources.has(String(edge.sourceHandle)), `${edge.id} source`).toBe(true);
      expect(targets.has(String(edge.targetHandle)), `${edge.id} target`).toBe(true);
    });
  });

  it('names operations that exist in the registry', () => {
    const check = (id: string, integration: any) => {
      const operation = (byId(id).data as any).operation;
      expect(operationsFor(integration).map((spec) => spec.id)).toContain(operation);
    };

    check('issues-pull', 'sheets');
    check('keepa-enrich', 'keepa');
    check('issues-write', 'sheets');
    check('asana-tasks', 'asana');
  });

  it('reads and writes the same tab, so the ranking lands on the source rows', () => {
    expect((byId('issues-pull').data as any).params.range).toBe(ISSUES_RANGE);
    expect((byId('issues-write').data as any).params.range).toBe(`${ISSUES_RANGE}!A1`);
  });

  it('keeps the issue columns through the Keepa lookup', () => {
    expect((byId('keepa-enrich').data as any).params.mergeInputRows).toBe(true);
  });

  it('hands back a fresh copy each time, so edits do not leak into the seed', () => {
    const first = createDefaultWorkflow();
    (first.nodes[0].data as any).title = 'edited';
    expect((createDefaultWorkflow().nodes[0].data as any).title).toBe('Run ASIN Issue Triage');
  });
});

describe('Rank Issues script', () => {
  const rows = [
    { asin: 'B-SLOW', issue: 'Typo', sales_rank: 900000, monthly_sold: 5 },
    { asin: 'B-FAST', issue: 'Suppressed', sales_rank: 400, monthly_sold: 8000 },
    { asin: 'B-MID', issue: 'Bad image', sales_rank: 9000, monthly_sold: 300 },
  ];

  it('puts the best-selling ASIN first and numbers the priorities', () => {
    const ranked = runScript('rank-issues', rows);

    expect(ranked.map((row: any) => row.asin)).toEqual(['B-FAST', 'B-MID', 'B-SLOW']);
    expect(ranked.map((row: any) => row.issue_priority)).toEqual([1, 2, 3]);
  });

  it('keeps every row and every original column', () => {
    const ranked = runScript('rank-issues', rows);

    expect(ranked).toHaveLength(rows.length);
    expect(ranked[0]).toMatchObject({ issue: 'Suppressed', sales_rank: 400 });
  });

  it('sinks rows with no Keepa data rather than floating them to the top', () => {
    const ranked = runScript('rank-issues', [
      { asin: 'B-NONE', sales_rank: null, monthly_sold: null },
      ...rows,
    ]);

    expect(ranked[ranked.length - 1].asin).toBe('B-NONE');
    expect(ranked[ranked.length - 1].issue_score).toBe(0);
  });

  it('survives an empty pull', () => {
    expect(runScript('rank-issues', [])).toEqual([]);
  });
});

describe('Top 10 script', () => {
  const ranked = Array.from({ length: 25 }, (_, i) => ({
    asin: `B${i}`,
    issue: `Issue ${i}`,
    sales_rank: 1000 + i,
    monthly_sold: 500 - i,
    issue_priority: i + 1,
    issue_score: 90 - i,
  }));

  it('cuts the list to ten', () => {
    expect(runScript('top-issues', ranked)).toHaveLength(10);
  });

  it('emits the Asana fields, not the raw ranking columns', () => {
    const [task] = runScript('top-issues', ranked);

    expect(task.name).toBe('[B0] Issue 0');
    expect(task.notes).toContain('Priority: #1 of 25');
    expect(task.notes).toContain('Sold last month: 500');
    expect(task).not.toHaveProperty('issue_score');
  });

  it('says "no data" instead of printing null into a task', () => {
    const [task] = runScript('top-issues', [
      { asin: 'B1', issue: 'Gap', sales_rank: null, monthly_sold: null, issue_priority: 1, issue_score: 0 },
    ]);

    expect(task.notes).toContain('Sales rank: no data');
    expect(task.notes).not.toContain('null');
  });

  it('passes fewer than ten through untouched', () => {
    expect(runScript('top-issues', ranked.slice(0, 3))).toHaveLength(3);
  });
});
