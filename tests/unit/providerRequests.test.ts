import { describe, it, expect } from 'vitest';
import {
  MCP_PROTOCOL_VERSION,
  buildChatPrompt,
  buildHuggingFaceRequest,
  buildMcpRequest,
  buildOpenRouterRequest,
  buildOpencodeRequest,
  extractCompletionText,
  extractMcpCallResult,
  extractOpencodeText,
  mcpInitializeParams,
  normalizeMcpTools,
  parseMcpResponseBody,
  splitOpencodeModel,
} from '@/lib/providerRequests';

describe('Chat prompt assembly', () => {
  it('returns the bare instruction when there are no rows', () => {
    expect(buildChatPrompt('Summarize this', [])).toBe('Summarize this');
  });

  it('falls back to a default instruction when the prompt is blank', () => {
    expect(buildChatPrompt('   ', [])).toBe('Summarize the input data.');
  });

  it('appends the rows and states how many there are', () => {
    const prompt = buildChatPrompt('Find outliers', [{ asin: 'A1' }, { asin: 'A2' }]);

    expect(prompt).toContain('Find outliers');
    expect(prompt).toContain('Input data (2 rows)');
    expect(prompt).toContain('"asin": "A1"');
  });

  it('truncates large batches and says how many were dropped', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ i }));
    const prompt = buildChatPrompt('Go', rows, 3);

    expect(prompt).toContain('Input data (10 rows)');
    expect(prompt).toContain('(7 further rows omitted.)');
    expect(prompt).not.toContain('"i": 5');
  });
});

describe('OpenRouter requests', () => {
  const config = { apiKey: 'sk-or-v1-abc', model: 'anthropic/claude-sonnet-4.5' };

  it('posts a chat completion with auth and the configured model', () => {
    const request = buildOpenRouterRequest(config, 'hello');

    expect(request.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer sk-or-v1-abc');
    expect(request.body.model).toBe('anthropic/claude-sonnet-4.5');
    expect(request.body.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('lets the node override the model and prepend a system prompt', () => {
    const request = buildOpenRouterRequest(config, 'hello', {
      model: 'openai/gpt-4.1',
      systemPrompt: 'Be terse',
    });

    expect(request.body.model).toBe('openai/gpt-4.1');
    expect(request.body.messages[0]).toEqual({ role: 'system', content: 'Be terse' });
    expect(request.body.messages[1]).toEqual({ role: 'user', content: 'hello' });
  });

  it('honours a self-hosted base URL and sends the app title', () => {
    const request = buildOpenRouterRequest(
      { ...config, baseUrl: 'https://proxy.test/v1/', appName: 'Bernie' },
      'hi'
    );
    expect(request.url).toBe('https://proxy.test/v1/chat/completions');
    expect(request.headers['X-Title']).toBe('Bernie');
  });

  it('requires a key and a model', () => {
    expect(() => buildOpenRouterRequest({}, 'hi')).toThrow(/API key is required/i);
    expect(() => buildOpenRouterRequest({ apiKey: 'k' }, 'hi')).toThrow(/choose a model/i);
  });
});

describe('Hugging Face requests', () => {
  it('uses the router with an OpenAI-shaped body by default', () => {
    const request = buildHuggingFaceRequest({ token: 'hf_x', model: 'meta-llama/Llama-3.3-70B-Instruct' }, 'hi');

    expect(request.url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer hf_x');
    expect(request.body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('posts the plain inference payload to a dedicated endpoint', () => {
    const request = buildHuggingFaceRequest(
      { token: 'hf_x', endpointUrl: 'https://abc.endpoints.huggingface.cloud/' },
      'hi'
    );

    expect(request.url).toBe('https://abc.endpoints.huggingface.cloud');
    expect(request.body).toEqual({ inputs: 'hi' });
  });

  it('requires a token, and a model when there is no dedicated endpoint', () => {
    expect(() => buildHuggingFaceRequest({}, 'hi')).toThrow(/access token is required/i);
    expect(() => buildHuggingFaceRequest({ token: 'hf_x' }, 'hi')).toThrow(/choose a model/i);
  });
});

describe('Completion response parsing', () => {
  it('reads an OpenAI-shaped completion', () => {
    expect(extractCompletionText({ choices: [{ message: { content: 'done' } }] })).toBe('done');
    expect(extractCompletionText({ choices: [{ text: 'legacy' }] })).toBe('legacy');
  });

  it('joins content returned as typed parts', () => {
    const payload = { choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] };
    expect(extractCompletionText(payload)).toBe('ab');
  });

  it('reads the Hugging Face inference array shapes', () => {
    expect(extractCompletionText([{ generated_text: 'gen' }])).toBe('gen');
    expect(extractCompletionText([{ summary_text: 'sum' }])).toBe('sum');
    expect(extractCompletionText({ generated_text: 'obj' })).toBe('obj');
    expect(extractCompletionText('plain')).toBe('plain');
  });

  it('returns null when there is no text to find', () => {
    expect(extractCompletionText(null)).toBeNull();
    expect(extractCompletionText({})).toBeNull();
    expect(extractCompletionText({ choices: [] })).toBeNull();
  });
});

describe('opencode requests', () => {
  it('splits a provider-qualified model id', () => {
    expect(splitOpencodeModel('anthropic/claude-sonnet-4.5')).toEqual({
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4.5',
    });
    // Model ids may themselves contain slashes; only the first one splits.
    expect(splitOpencodeModel('openrouter/meta/llama-3')).toEqual({
      providerID: 'openrouter',
      modelID: 'meta/llama-3',
    });
  });

  it('treats an unqualified or malformed model id as unset', () => {
    expect(splitOpencodeModel('claude-sonnet')).toBeNull();
    expect(splitOpencodeModel('/leading')).toBeNull();
    expect(splitOpencodeModel('trailing/')).toBeNull();
    expect(splitOpencodeModel(undefined)).toBeNull();
  });

  it('builds the session and message URLs off the server URL', () => {
    const request = buildOpencodeRequest({ baseUrl: 'http://localhost:4096/' }, 'fix the test');

    expect(request.sessionUrl).toBe('http://localhost:4096/session');
    expect(request.messageUrl('abc')).toBe('http://localhost:4096/session/abc/message');
    expect(request.body.parts).toEqual([{ type: 'text', text: 'fix the test' }]);
    expect(request.body.model).toBeUndefined();
  });

  it('includes the split model and a bearer token when configured', () => {
    const request = buildOpencodeRequest(
      { baseUrl: 'http://localhost:4096', apiKey: 'secret', model: 'anthropic/claude-sonnet-4.5' },
      'hi'
    );

    expect(request.headers.Authorization).toBe('Bearer secret');
    expect(request.body.model).toEqual({ providerID: 'anthropic', modelID: 'claude-sonnet-4.5' });
  });

  it('requires a server URL', () => {
    expect(() => buildOpencodeRequest({}, 'hi')).toThrow(/server URL is required/i);
  });

  it('collects the text parts of a message response', () => {
    expect(
      extractOpencodeText({ parts: [{ type: 'text', text: 'one' }, { type: 'tool', text: 'skip' }, { type: 'text', text: 'two' }] })
    ).toBe('one\ntwo');
    expect(extractOpencodeText({ message: { parts: [{ type: 'text', text: 'nested' }] } })).toBe('nested');
    expect(extractOpencodeText({ text: 'flat' })).toBe('flat');
    expect(extractOpencodeText({})).toBeNull();
  });
});

describe('MCP requests', () => {
  const config = { serverUrl: 'http://localhost:3001/mcp' };

  it('builds a JSON-RPC envelope that accepts either response encoding', () => {
    const request = buildMcpRequest(config, 'tools/list', {}, 7);

    expect(request.url).toBe('http://localhost:3001/mcp');
    expect(request.headers.Accept).toBe('application/json, text/event-stream');
    expect(request.body).toEqual({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} });
  });

  it('passes a session id back on later calls', () => {
    const request = buildMcpRequest(config, 'tools/call', { name: 'x' }, 2, 'sess-1');
    expect(request.headers['Mcp-Session-Id']).toBe('sess-1');
  });

  it('omits params entirely when there are none', () => {
    expect(buildMcpRequest(config, 'ping', undefined, 1).body).toEqual({ jsonrpc: '2.0', id: 1, method: 'ping' });
  });

  it('rejects the transports that are not implemented, by name', () => {
    expect(() => buildMcpRequest({ serverUrl: 'ws://localhost:3001' }, 'tools/list', {}, 1)).toThrow(
      /only http\(s\) endpoints are supported/i
    );
    expect(() => buildMcpRequest({}, 'tools/list', {}, 1)).toThrow(/server URL is required/i);
  });

  it('declares a protocol version and client identity on initialize', () => {
    const params = mcpInitializeParams();
    expect(params.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(params.clientInfo.name).toBe('bernie-workflow-canvas');
  });

  it('parses a plain JSON body', () => {
    expect(parseMcpResponseBody('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}')).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { ok: true },
    });
  });

  it('parses the last JSON-RPC frame out of an SSE stream', () => {
    const sse = 'event: message\ndata: {"id":1,"result":{"first":true}}\n\nevent: message\ndata: {"id":2,"result":{"second":true}}\n\n';
    expect(parseMcpResponseBody(sse)).toEqual({ id: 2, result: { second: true } });
  });

  it('survives empty, partial and malformed bodies', () => {
    expect(parseMcpResponseBody('')).toBeNull();
    expect(parseMcpResponseBody('not json')).toBeNull();
    expect(parseMcpResponseBody('data: {"broken":')).toBeNull();
    expect(parseMcpResponseBody('data: [DONE]')).toBeNull();
  });

  it('flattens a tools/list result into rows', () => {
    const rows = normalizeMcpTools({
      result: {
        tools: [
          {
            name: 'search',
            description: 'Search the docs',
            inputSchema: { required: ['query'], properties: { query: {}, limit: {} } },
          },
        ],
      },
    });

    expect(rows).toEqual([
      { name: 'search', description: 'Search the docs', required: 'query', properties: 'query, limit' },
    ]);
  });

  it('returns no rows when the payload has no tools', () => {
    expect(normalizeMcpTools({})).toEqual([]);
    expect(normalizeMcpTools({ result: {} })).toEqual([]);
  });

  it('reduces a tools/call result to text plus structured content', () => {
    const result = extractMcpCallResult({
      result: {
        content: [{ type: 'text', text: 'line one' }, { type: 'image' }, { type: 'text', text: 'line two' }],
        structuredContent: { count: 2 },
      },
    });

    expect(result.text).toBe('line one\nline two');
    expect(result.structured).toEqual({ count: 2 });
  });

  it('reports no text when a call returned none', () => {
    expect(extractMcpCallResult({ result: {} })).toEqual({ text: null, structured: null });
  });
});
