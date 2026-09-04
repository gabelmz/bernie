import { Node, Edge } from '@xyflow/react';

export interface WorkflowValidationIssue {
  type: 'error' | 'warning' | 'info';
  nodeId?: string;
  message: string;
  suggestion?: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  hasCycles: boolean;
  issues: WorkflowValidationIssue[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    entryNodes: number;
    terminalNodes: number;
    isolatedNodes: number;
  };
}

export interface StepExecutionResult {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  status: 'success' | 'error' | 'skipped';
  input?: any;
  output?: any;
  errorMessage?: string;
  durationMs: number;
}

export interface WorkflowExecutionReport {
  success: boolean;
  totalDurationMs: number;
  steps: StepExecutionResult[];
  errors: string[];
}

/**
 * Extract field names / headers from arbitrary payloads (arrays of objects or single objects)
 */
export function extractPayloadHeaders(data: any): string[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (typeof data[0] === 'object' && data[0] !== null) {
      return Object.keys(data[0]);
    }
    return ['value'];
  }
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data);
  }
  return ['value'];
}

/**
 * Detect cycles in the directed graph formed by nodes and edges
 */
export function detectGraphCycles(nodes: Node[], edges: Edge[]): { hasCycles: boolean; cycleNodes: string[] } {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    if (adj.has(e.source)) {
      adj.get(e.source)!.push(e.target);
    }
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycleNodes = new Set<string>();

  function dfs(u: string): boolean {
    visited.add(u);
    recStack.add(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (!visited.has(v)) {
        if (dfs(v)) {
          cycleNodes.add(u);
          return true;
        }
      } else if (recStack.has(v)) {
        cycleNodes.add(u);
        cycleNodes.add(v);
        return true;
      }
    }

    recStack.delete(u);
    return false;
  }

  let foundCycle = false;
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        foundCycle = true;
      }
    }
  }

  return { hasCycles: foundCycle, cycleNodes: Array.from(cycleNodes) };
}

/**
 * Validates a workflow canvas for common issues, broken configurations, and topology defects
 */
export function validateWorkflow(nodes: Node[], edges: Edge[]): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Verify edges have valid source and target
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        type: 'error',
        message: `Edge ${edge.id} references non-existent source node "${edge.source}".`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        type: 'error',
        message: `Edge ${edge.id} references non-existent target node "${edge.target}".`,
      });
    }
  });

  // Cycle detection
  const { hasCycles, cycleNodes } = detectGraphCycles(nodes, edges);
  if (hasCycles) {
    issues.push({
      type: 'error',
      message: `Circular dependency detected involving nodes: ${cycleNodes.join(', ')}.`,
      suggestion: 'Remove or break cyclical connections to ensure predictable execution flow.',
    });
  }

  // Check incoming and outgoing degrees
  let entryCount = 0;
  let terminalCount = 0;
  let isolatedCount = 0;

  nodes.forEach((node) => {
    const incoming = edges.filter((e) => e.target === node.id);
    const outgoing = edges.filter((e) => e.source === node.id);

    if (incoming.length === 0 && outgoing.length === 0 && nodes.length > 1) {
      isolatedCount++;
      issues.push({
        type: 'warning',
        nodeId: node.id,
        message: `Node "${node.data?.title || node.id}" is isolated and has no connections.`,
        suggestion: 'Connect this node to other nodes or remove it if not needed.',
      });
    }

    if (incoming.length === 0 && outgoing.length > 0) {
      entryCount++;
    }
    if (incoming.length > 0 && outgoing.length === 0) {
      terminalCount++;
    }

    // Node-specific configuration validations
    if (node.type === 'http') {
      const url = node.data?.url;
      if (!url || typeof url !== 'string' || !url.trim()) {
        issues.push({
          type: 'error',
          nodeId: node.id,
          message: `HTTP Node "${node.data?.title || node.id}" is missing a request URL.`,
          suggestion: 'Specify a valid HTTP or HTTPS endpoint URL in node settings.',
        });
      }
    }

    if (node.type === 'script') {
      const script = node.data?.script;
      if (!script || typeof script !== 'string' || !script.trim()) {
        issues.push({
          type: 'warning',
          nodeId: node.id,
          message: `Script Node "${node.data?.title || node.id}" has no execution code.`,
          suggestion: 'Add JavaScript return logic to process input payloads.',
        });
      }
    }

    if (node.type === 'filter') {
      const condition = node.data?.condition;
      if (!condition && !node.data?.filterKey) {
        issues.push({
          type: 'info',
          nodeId: node.id,
          message: `Filter Node "${node.data?.title || node.id}" has no active criteria set.`,
          suggestion: 'Set a condition or key filter to narrow down payloads.',
        });
      }
    }
  });

  const hasErrors = issues.some((i) => i.type === 'error');

  return {
    valid: !hasErrors,
    hasCycles,
    issues,
    metrics: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      entryNodes: entryCount,
      terminalNodes: terminalCount,
      isolatedNodes: isolatedCount,
    },
  };
}

/**
 * Propagate node output data downstream to all directly connected target nodes
 */
export function propagateNodeData(
  nodes: Node[],
  edges: Edge[],
  sourceNodeId: string,
  outputData: any
): Node[] {
  const updatedNodes = nodes.map((node) => {
    if (node.id === sourceNodeId) {
      let updateObj: Record<string, any> = { status: 'success' };
      if (node.type === 'drive' || node.type === 'sheet' || node.type === 'chat' || node.type === 'meet') {
        updateObj.mappedData = outputData;
      } else if (node.type === 'http') {
        updateObj.response = outputData;
      } else if (node.type === 'ai') {
        updateObj.result = outputData;
      } else if (node.type === 'text') {
        updateObj.text = outputData?.text ?? (typeof outputData === 'string' ? outputData : JSON.stringify(outputData));
      } else if (node.type === 'script') {
        updateObj.result = outputData;
      } else if (node.type === 'flush') {
        updateObj.flushedData = outputData;
      } else {
        updateObj.jsonData = outputData;
      }

      if (outputData?.error) {
        updateObj.status = 'error';
        updateObj.errorMessage = outputData.error;
      }

      return {
        ...node,
        data: {
          ...node.data,
          ...updateObj,
        },
      };
    }
    return node;
  });

  // If node errored, don't cascade running state
  if (outputData?.error) {
    return updatedNodes;
  }

  const outEdges = edges.filter((e) => e.source === sourceNodeId);
  if (outEdges.length === 0) {
    return updatedNodes;
  }

  const targetIds = new Set(outEdges.map((e) => e.target));
  return updatedNodes.map((node) => {
    if (targetIds.has(node.id)) {
      return {
        ...node,
        data: {
          ...node.data,
          inputData: outputData,
          status: 'running',
        },
      };
    }
    return node;
  });
}

/**
 * Evaluates node logic in simulation mode for automated testing and workflow dry-runs
 */
export function executeNodeSimulation(node: Node, inputData: any): any {
  const data = node.data || {};

  switch (node.type) {
    case 'json': {
      return data.jsonData || inputData || { status: 'ok' };
    }
    case 'text': {
      let text = String(data.text || '');
      if (typeof inputData === 'object' && inputData !== null) {
        Object.entries(inputData).forEach(([key, val]) => {
          text = text.replaceAll(`{{${key}}}`, String(val));
        });
      } else if (inputData !== undefined) {
        text = text.replaceAll('{{input}}', String(inputData));
      }
      return { text };
    }
    case 'math': {
      const op = data.operation || '+';
      const operand = Number(data.operand ?? 0);
      let num = 0;
      if (typeof inputData === 'number') {
        num = inputData;
      } else if (inputData && typeof inputData === 'object') {
        if (typeof inputData.value === 'number') {
          num = inputData.value;
        } else {
          const numericEntry = Object.values(inputData).find((v) => typeof v === 'number');
          if (typeof numericEntry === 'number') {
            num = numericEntry;
          } else {
            const parsed = Number(inputData.value ?? 0);
            num = isNaN(parsed) ? 0 : parsed;
          }
        }
      } else if (inputData !== undefined && !isNaN(Number(inputData))) {
        num = Number(inputData);
      }

      let result: number;
      switch (op) {
        case '+':
          result = num + operand;
          break;
        case '-':
          result = num - operand;
          break;
        case '*':
          result = num * operand;
          break;
        case '/':
          result = operand !== 0 ? num / operand : 0;
          break;
        default:
          result = num;
      }
      return { value: result, formula: `${num} ${op} ${operand} = ${result}` };
    }
    case 'filter': {
      const items = Array.isArray(inputData) ? inputData : Array.isArray(inputData?.items) ? inputData.items : null;
      if (items) {
        const key = data.filterKey ? String(data.filterKey) : '';
        const op = String(data.filterOp || 'exists');
        const expected = data.filterValue !== undefined ? String(data.filterValue) : '';

        const filtered = items.filter((item: any) => {
          if (!key) return Boolean(item);
          const val = item?.[key];
          if (op === 'equals') return String(val) === expected;
          if (op === 'contains') return String(val).toLowerCase().includes(expected.toLowerCase());
          if (op === 'gt') return Number(val) > Number(expected);
          if (op === 'lt') return Number(val) < Number(expected);
          return val !== undefined && val !== null;
        });
        return filtered;
      }
      return inputData;
    }
    case 'script': {
      const script = typeof data.script === 'string' ? data.script : 'return input;';
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('input', script);
        return fn(inputData);
      } catch (err: any) {
        return { error: err?.message || 'Script evaluation error' };
      }
    }
    case 'flush': {
      return {
        flushedAt: Date.now(),
        buffered: inputData,
        count: Array.isArray(inputData) ? inputData.length : 1,
      };
    }
    case 'trigger': {
      return {
        triggeredAt: Date.now(),
        source: 'workflow-test-simulation',
      };
    }
    default:
      return inputData ?? { executed: true, timestamp: Date.now() };
  }
}

/**
 * Executes a simulated run through an entire workflow graph in topological order
 */
export function simulateWorkflowExecution(
  nodes: Node[],
  edges: Edge[],
  startNodeId?: string,
  initialPayload?: any
): WorkflowExecutionReport {
  const startTime = Date.now();
  const steps: StepExecutionResult[] = [];
  const errors: string[] = [];

  const { hasCycles } = detectGraphCycles(nodes, edges);
  if (hasCycles) {
    return {
      success: false,
      totalDurationMs: 0,
      steps: [],
      errors: ['Cannot simulate workflow containing cycles / loops.'],
    };
  }

  // Find start nodes
  let executionQueue: string[] = [];
  if (startNodeId) {
    executionQueue.push(startNodeId);
  } else {
    // All nodes with 0 incoming edges
    const targetSet = new Set(edges.map((e) => e.target));
    const entries = nodes.filter((n) => !targetSet.has(n.id)).map((n) => n.id);
    executionQueue = entries.length > 0 ? entries : nodes.map((n) => n.id);
  }

  const nodeDataMap = new Map<string, any>();
  if (startNodeId && initialPayload !== undefined) {
    nodeDataMap.set(startNodeId, initialPayload);
  }

  const visited = new Set<string>();

  while (executionQueue.length > 0) {
    const currentId = executionQueue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (!node) continue;

    const stepStart = Date.now();
    const input = nodeDataMap.get(currentId) ?? node.data?.inputData ?? node.data?.jsonData;

    try {
      const output = executeNodeSimulation(node, input);
      const stepDuration = Math.max(1, Date.now() - stepStart);

      if (output?.error) {
        errors.push(`Node "${node.data?.title || node.id}" error: ${output.error}`);
        steps.push({
          nodeId: node.id,
          nodeTitle: String(node.data?.title || node.id),
          nodeType: node.type || 'custom',
          status: 'error',
          input,
          output,
          errorMessage: output.error,
          durationMs: stepDuration,
        });
      } else {
        steps.push({
          nodeId: node.id,
          nodeTitle: String(node.data?.title || node.id),
          nodeType: node.type || 'custom',
          status: 'success',
          input,
          output,
          durationMs: stepDuration,
        });

        // Pass output to downstream targets
        const targets = edges.filter((e) => e.source === currentId).map((e) => e.target);
        targets.forEach((tgtId) => {
          nodeDataMap.set(tgtId, output);
          if (!visited.has(tgtId) && !executionQueue.includes(tgtId)) {
            executionQueue.push(tgtId);
          }
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Execution exception';
      errors.push(`Node "${node.data?.title || node.id}" failed: ${msg}`);
      steps.push({
        nodeId: node.id,
        nodeTitle: String(node.data?.title || node.id),
        nodeType: node.type || 'custom',
        status: 'error',
        input,
        errorMessage: msg,
        durationMs: Math.max(1, Date.now() - stepStart),
      });
    }
  }

  return {
    success: errors.length === 0,
    totalDurationMs: Date.now() - startTime,
    steps,
    errors,
  };
}
