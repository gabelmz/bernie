import { describe, it, expect } from 'vitest';
import {
  extractPayloadHeaders,
  detectGraphCycles,
  validateWorkflow,
  propagateNodeData,
  executeNodeSimulation,
  simulateWorkflowExecution,
} from '@/lib/workflowEngine';
import { Node, Edge } from '@xyflow/react';

describe('Workflow Engine - Header Extraction', () => {
  it('extracts keys from an array of objects', () => {
    const data = [
      { id: 1, name: 'Alpha', email: 'alpha@test.com' },
      { id: 2, name: 'Beta', email: 'beta@test.com' },
    ];
    const headers = extractPayloadHeaders(data);
    expect(headers).toEqual(['id', 'name', 'email']);
  });

  it('extracts keys from a single object', () => {
    const data = { status: 'success', count: 42, details: { active: true } };
    const headers = extractPayloadHeaders(data);
    expect(headers).toEqual(['status', 'count', 'details']);
  });

  it('handles empty arrays, primitives, and null gracefully', () => {
    expect(extractPayloadHeaders([])).toEqual([]);
    expect(extractPayloadHeaders(null)).toEqual([]);
    expect(extractPayloadHeaders(undefined)).toEqual([]);
    expect(extractPayloadHeaders('simple string')).toEqual(['value']);
    expect(extractPayloadHeaders([1, 2, 3])).toEqual(['value']);
  });
});

describe('Workflow Engine - Cycle Detection', () => {
  it('detects a clean acyclic pipeline', () => {
    const nodes: Node[] = [
      { id: '1', position: { x: 0, y: 0 }, data: { title: 'Node 1' } },
      { id: '2', position: { x: 100, y: 0 }, data: { title: 'Node 2' } },
      { id: '3', position: { x: 200, y: 0 }, data: { title: 'Node 3' } },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
    ];

    const result = detectGraphCycles(nodes, edges);
    expect(result.hasCycles).toBe(false);
    expect(result.cycleNodes).toHaveLength(0);
  });

  it('detects a circular dependency (A -> B -> C -> A)', () => {
    const nodes: Node[] = [
      { id: 'A', position: { x: 0, y: 0 }, data: {} },
      { id: 'B', position: { x: 100, y: 0 }, data: {} },
      { id: 'C', position: { x: 200, y: 0 }, data: {} },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' },
    ];

    const result = detectGraphCycles(nodes, edges);
    expect(result.hasCycles).toBe(true);
    expect(result.cycleNodes.length).toBeGreaterThan(0);
  });

  it('detects self-loop edges (A -> A)', () => {
    const nodes: Node[] = [{ id: 'A', position: { x: 0, y: 0 }, data: {} }];
    const edges: Edge[] = [{ id: 'e-self', source: 'A', target: 'A' }];

    const result = detectGraphCycles(nodes, edges);
    expect(result.hasCycles).toBe(true);
  });
});

describe('Workflow Engine - Validation', () => {
  it('identifies invalid edge references when nodes are missing', () => {
    const nodes: Node[] = [{ id: '1', position: { x: 0, y: 0 }, data: { title: 'Single' } }];
    const edges: Edge[] = [{ id: 'e-bad', source: '1', target: 'nonexistent-99' }];

    const validation = validateWorkflow(nodes, edges);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.message.includes('nonexistent-99'))).toBe(true);
  });

  it('identifies unconfigured HTTP nodes with missing URLs', () => {
    const nodes: Node[] = [
      { id: 'http-1', type: 'http', position: { x: 0, y: 0 }, data: { title: 'API Call', url: '' } },
    ];
    const validation = validateWorkflow(nodes, []);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((i) => i.message.includes('missing a request URL'))).toBe(true);
  });

  it('reports isolated nodes when there are multiple disconnected components', () => {
    const nodes: Node[] = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { title: 'Connected 1' } },
      { id: 'n2', position: { x: 100, y: 0 }, data: { title: 'Connected 2' } },
      { id: 'n3', position: { x: 200, y: 0 }, data: { title: 'Lonely Node' } },
    ];
    const edges: Edge[] = [{ id: 'e1-2', source: 'n1', target: 'n2' }];

    const validation = validateWorkflow(nodes, edges);
    expect(validation.metrics.isolatedNodes).toBe(1);
    expect(validation.issues.some((i) => i.message.includes('Lonely Node'))).toBe(true);
  });
});

describe('Workflow Engine - Data Propagation', () => {
  it('propagates data to downstream targets and updates status to running', () => {
    const nodes: Node[] = [
      { id: 'src', type: 'json', position: { x: 0, y: 0 }, data: { title: 'Source' } },
      { id: 'tgt', type: 'text', position: { x: 100, y: 0 }, data: { title: 'Target' } },
    ];
    const edges: Edge[] = [{ id: 'e-1', source: 'src', target: 'tgt' }];

    const payload = { greeting: 'hello world' };
    const updated = propagateNodeData(nodes, edges, 'src', payload);

    const srcNode = updated.find((n) => n.id === 'src');
    const tgtNode = updated.find((n) => n.id === 'tgt');

    expect(srcNode?.data.status).toBe('success');
    expect(srcNode?.data.jsonData).toEqual(payload);
    expect(tgtNode?.data.status).toBe('running');
    expect(tgtNode?.data.inputData).toEqual(payload);
  });

  it('halts cascade if source node produced an error', () => {
    const nodes: Node[] = [
      { id: 'src', type: 'http', position: { x: 0, y: 0 }, data: { title: 'Source' } },
      { id: 'tgt', type: 'text', position: { x: 100, y: 0 }, data: { title: 'Target', status: 'idle' } },
    ];
    const edges: Edge[] = [{ id: 'e-1', source: 'src', target: 'tgt' }];

    const errorPayload = { error: 'Network timeout 504' };
    const updated = propagateNodeData(nodes, edges, 'src', errorPayload);

    const srcNode = updated.find((n) => n.id === 'src');
    const tgtNode = updated.find((n) => n.id === 'tgt');

    expect(srcNode?.data.status).toBe('error');
    expect(srcNode?.data.errorMessage).toBe('Network timeout 504');
    expect(tgtNode?.data.status).toBe('idle');
    expect(tgtNode?.data.inputData).toBeUndefined();
  });
});

describe('Workflow Engine - Node Simulation', () => {
  it('simulates MathNode operations accurately', () => {
    const mathAddNode: Node = {
      id: 'm1',
      type: 'math',
      position: { x: 0, y: 0 },
      data: { operation: '+', operand: 15 },
    };
    expect(executeNodeSimulation(mathAddNode, 25)).toEqual({
      value: 40,
      formula: '25 + 15 = 40',
    });

    const mathMulNode: Node = {
      id: 'm2',
      type: 'math',
      position: { x: 0, y: 0 },
      data: { operation: '*', operand: 4 },
    };
    expect(executeNodeSimulation(mathMulNode, 10)).toEqual({
      value: 40,
      formula: '10 * 4 = 40',
    });

    const mathDivNode: Node = {
      id: 'm3',
      type: 'math',
      position: { x: 0, y: 0 },
      data: { operation: '/', operand: 0 },
    };
    expect(executeNodeSimulation(mathDivNode, 10)).toEqual({
      value: 0,
      formula: '10 / 0 = 0',
    });
  });

  it('simulates TextNode variable interpolation', () => {
    const textNode: Node = {
      id: 't1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { text: 'Hello {{name}}, your order #{{orderId}} is confirmed!' },
    };
    const input = { name: 'Alice', orderId: 89201 };
    expect(executeNodeSimulation(textNode, input)).toEqual({
      text: 'Hello Alice, your order #89201 is confirmed!',
    });
  });

  it('simulates FilterNode array condition filtering', () => {
    const filterNode: Node = {
      id: 'f1',
      type: 'filter',
      position: { x: 0, y: 0 },
      data: { filterKey: 'active', filterOp: 'equals', filterValue: 'true' },
    };
    const inputList = [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: true },
    ];
    const res = executeNodeSimulation(filterNode, inputList);
    expect(res).toEqual([
      { id: 1, active: true },
      { id: 3, active: true },
    ]);
  });

  it('simulates ScriptNode safe code execution and error catching', () => {
    const goodScriptNode: Node = {
      id: 's1',
      type: 'script',
      position: { x: 0, y: 0 },
      data: { script: 'return { doubled: input.value * 2 };' },
    };
    expect(executeNodeSimulation(goodScriptNode, { value: 21 })).toEqual({ doubled: 42 });

    const badScriptNode: Node = {
      id: 's2',
      type: 'script',
      position: { x: 0, y: 0 },
      data: { script: 'throw new Error("Syntax defect or invalid property");' },
    };
    const errRes = executeNodeSimulation(badScriptNode, {});
    expect(errRes.error).toContain('Syntax defect or invalid property');
  });
});

describe('Workflow Engine - End-to-End Simulation Pipeline', () => {
  it('executes a 3-step pipeline (JSON -> Math -> Text) with full report', () => {
    const nodes: Node[] = [
      {
        id: 'step1',
        type: 'json',
        position: { x: 0, y: 0 },
        data: { title: 'Raw Score', jsonData: { score: 50 } },
      },
      {
        id: 'step2',
        type: 'math',
        position: { x: 100, y: 0 },
        data: { title: 'Bonus Points', operation: '+', operand: 25 },
      },
      {
        id: 'step3',
        type: 'text',
        position: { x: 200, y: 0 },
        data: { title: 'Announcement', text: 'Final score calculated: {{value}}' },
      },
    ];
    const edges: Edge[] = [
      { id: 'e1-2', source: 'step1', target: 'step2' },
      { id: 'e2-3', source: 'step2', target: 'step3' },
    ];

    const report = simulateWorkflowExecution(nodes, edges);
    expect(report.success).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.steps).toHaveLength(3);

    expect(report.steps[0].nodeId).toBe('step1');
    expect(report.steps[1].nodeId).toBe('step2');
    expect(report.steps[1].output.value).toBe(75);
    expect(report.steps[2].nodeId).toBe('step3');
    expect(report.steps[2].output.text).toBe('Final score calculated: 75');
  });

  it('rejects execution when graph has cyclical dependencies', () => {
    const nodes: Node[] = [
      { id: 'c1', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'c2', position: { x: 100, y: 0 }, data: { title: 'B' } },
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'c1', target: 'c2' },
      { id: 'e2', source: 'c2', target: 'c1' },
    ];

    const report = simulateWorkflowExecution(nodes, edges);
    expect(report.success).toBe(false);
    expect(report.errors[0]).toContain('cycles');
  });
});
