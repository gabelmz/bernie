/**
 * Operations for the model providers, MCP and the generic HTTP node. These
 * mostly carry a `custom` marker: they are not one plain REST call, so the
 * server runs them through a dedicated handler rather than the request engine.
 */

import { IntegrationOperations, OperationSpec, jsonField, numberField, rawOperation, textField } from './types';

const PROMPT_FIELDS: OperationSpec['fields'] = [
  jsonField('prompt', 'Prompt', 'Summarize the input rows...'),
  textField('model', 'Model', 'Defaults to the connection setting'),
  numberField('sampleSize', 'Rows Sent To The Model', '40'),
];

const openrouterOps: OperationSpec[] = [
  {
    id: 'chat.complete',
    label: 'Complete a prompt',
    direction: 'mutate',
    summary: 'Sends the prompt plus the incoming rows to a hosted model.',
    docsUrl: 'https://openrouter.ai/docs/api-reference/chat-completion',
    method: 'POST',
    path: '/chat/completions',
    result: 'passthrough',
    custom: 'openrouter.complete',
    emitsRows: true,
    fields: [...PROMPT_FIELDS, jsonField('systemPrompt', 'System Prompt', 'You are a concise analyst...')],
  },
  {
    id: 'models.list',
    label: 'List models',
    direction: 'pull',
    summary: 'Every model OpenRouter can route to, with pricing.',
    docsUrl: 'https://openrouter.ai/docs/api-reference/list-available-models',
    method: 'GET',
    path: '/models',
    result: 'rows',
    resultPath: 'data',
    emitsRows: true,
  },
  {
    id: 'key.status',
    label: 'Check key',
    direction: 'pull',
    summary: 'Credit and rate-limit status for the configured key.',
    docsUrl: 'https://openrouter.ai/docs/api-reference/limits',
    method: 'GET',
    path: '/key',
    result: 'single',
    resultPath: 'data',
    emitsRows: true,
  },
  rawOperation('https://openrouter.ai/docs/api-reference', '/models'),
];

const huggingfaceOps: OperationSpec[] = [
  {
    id: 'chat.complete',
    label: 'Run inference',
    direction: 'mutate',
    summary: 'Sends the prompt plus the incoming rows to the model or endpoint.',
    docsUrl: 'https://huggingface.co/docs/api-inference/index',
    method: 'POST',
    path: '/v1/chat/completions',
    result: 'passthrough',
    custom: 'huggingface.complete',
    emitsRows: true,
    fields: PROMPT_FIELDS,
  },
  {
    id: 'whoami',
    label: 'Check token',
    direction: 'pull',
    summary: 'The account the access token belongs to.',
    docsUrl: 'https://huggingface.co/docs/hub/api',
    method: 'GET',
    path: '/api/whoami-v2',
    result: 'single',
    emitsRows: true,
    custom: 'huggingface.whoami',
  },
  rawOperation('https://huggingface.co/docs/hub/api', '/api/models'),
];

const opencodeOps: OperationSpec[] = [
  {
    id: 'session.prompt',
    label: 'Send a prompt',
    direction: 'mutate',
    summary: 'Prompts an opencode session, creating one when no id is given.',
    docsUrl: 'https://opencode.ai/docs/server/',
    method: 'POST',
    path: '/session',
    result: 'passthrough',
    custom: 'opencode.prompt',
    emitsRows: true,
    fields: [
      ...PROMPT_FIELDS,
      textField('sessionId', 'Session ID', 'Blank starts a new session', 'Reuse an id to keep context across runs.'),
    ],
  },
  {
    id: 'session.list',
    label: 'List sessions',
    direction: 'pull',
    summary: 'Sessions the server currently holds.',
    docsUrl: 'https://opencode.ai/docs/server/',
    method: 'GET',
    path: '/session',
    result: 'rows',
    emitsRows: true,
  },
  {
    id: 'config.get',
    label: 'Get config',
    direction: 'pull',
    summary: 'The server’s configuration, including available providers.',
    docsUrl: 'https://opencode.ai/docs/server/',
    method: 'GET',
    path: '/config',
    result: 'single',
    emitsRows: true,
  },
  rawOperation('https://opencode.ai/docs/server/', '/session'),
];

const geminiOps: OperationSpec[] = [
  {
    id: 'text.generate',
    label: 'Generate text',
    direction: 'mutate',
    summary: 'Runs the prompt against Gemini with the incoming rows as context.',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/text-generation',
    method: 'POST',
    path: '',
    result: 'passthrough',
    custom: 'gemini.generate',
    emitsRows: true,
    fields: PROMPT_FIELDS,
  },
  {
    id: 'insights.generate',
    label: 'Analyse rows',
    direction: 'mutate',
    summary: 'Returns structured findings, anomalies and recommendations.',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/structured-output',
    method: 'POST',
    path: '',
    result: 'passthrough',
    custom: 'gemini.insights',
    consumesRows: true,
    emitsRows: true,
    fields: [
      jsonField('focus', 'Analysis Focus', 'Flag pricing outliers and stalled tasks'),
      textField('model', 'Model', 'Defaults to the connection setting'),
      numberField('sampleSize', 'Rows Sent To The Model', '40'),
    ],
  },
];

export const aiOperations = {
  openrouter: { integration: 'openrouter', defaultOperation: 'chat.complete', operations: openrouterOps } as IntegrationOperations,
  huggingface: { integration: 'huggingface', defaultOperation: 'chat.complete', operations: huggingfaceOps } as IntegrationOperations,
  opencode: { integration: 'opencode', defaultOperation: 'session.prompt', operations: opencodeOps } as IntegrationOperations,
  gemini: { integration: 'gemini', defaultOperation: 'text.generate', operations: geminiOps } as IntegrationOperations,
};

const mcpOps: OperationSpec[] = [
  {
    id: 'tools.list',
    label: 'List tools',
    direction: 'pull',
    summary: 'The tools the MCP server exposes, as rows.',
    docsUrl: 'https://modelcontextprotocol.io/specification/server/tools',
    method: 'POST',
    path: '',
    result: 'rows',
    emitsRows: true,
    custom: 'mcp.rpc',
  },
  {
    id: 'tools.call',
    label: 'Call a tool',
    direction: 'mutate',
    summary: 'Calls one tool with JSON arguments.',
    docsUrl: 'https://modelcontextprotocol.io/specification/server/tools',
    method: 'POST',
    path: '',
    result: 'passthrough',
    emitsRows: true,
    custom: 'mcp.rpc',
    fields: [
      textField('tool', 'Tool Name', 'search_docs', undefined, true),
      jsonField('arguments', 'Arguments (JSON)', '{"query": "billing"}'),
    ],
  },
  {
    id: 'resources.list',
    label: 'List resources',
    direction: 'pull',
    summary: 'The resources the server exposes.',
    docsUrl: 'https://modelcontextprotocol.io/specification/server/resources',
    method: 'POST',
    path: '',
    result: 'rows',
    emitsRows: true,
    custom: 'mcp.rpc',
  },
  {
    id: 'prompts.list',
    label: 'List prompts',
    direction: 'pull',
    summary: 'The prompt templates the server exposes.',
    docsUrl: 'https://modelcontextprotocol.io/specification/server/prompts',
    method: 'POST',
    path: '',
    result: 'rows',
    emitsRows: true,
    custom: 'mcp.rpc',
  },
];

export const mcpOperations: IntegrationOperations = {
  integration: 'mcp',
  defaultOperation: 'tools.list',
  operations: mcpOps,
};

const httpOps: OperationSpec[] = [
  {
    id: 'request.send',
    label: 'Send a request',
    direction: 'raw',
    summary: 'Any HTTP call, using the saved base URL and headers.',
    method: 'GET',
    path: '',
    body: 'rawBody',
    result: 'passthrough',
    emitsRows: true,
    custom: 'http.request',
    fields: [
      {
        key: 'rawMethod',
        label: 'Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      textField('rawPath', 'URL Or Path', 'https://api.example.com/items', 'A relative path resolves against the saved base URL.'),
      jsonField('rawQuery', 'Query (JSON)', '{"limit": 50}'),
      jsonField('rawBody', 'Body (JSON)', 'Leave blank to send the input rows'),
      jsonField('rawHeaders', 'Extra Headers (JSON)', '{"X-Trace": "1"}'),
    ],
  },
];

export const httpOperations: IntegrationOperations = {
  integration: 'http',
  defaultOperation: 'request.send',
  operations: httpOps,
};
