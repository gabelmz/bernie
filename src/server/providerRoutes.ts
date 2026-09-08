/**
 * Routes backing the OpenRouter, Hugging Face, opencode, MCP and Drive nodes.
 * Each one resolves its config the same way as the MVP integrations (request
 * config wins, env vars as fallback) and surfaces the upstream error verbatim
 * so a node can show the user something actionable.
 */

import type { Express } from 'express';
import {
  DriveConfig,
  HuggingFaceConfig,
  McpConfig,
  OpenRouterConfig,
  OpencodeConfig,
  toRows,
} from '../lib/integrationCore';
import {
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
} from '../lib/providerRequests';
import { assertConfigured, errorStatus, mergedConfig, probe, readJsonResponse } from './integrationKit';

/** Reads the prompt plus rows a chat-style node sends. */
function chatContent(body: any): string {
  const rows = toRows(body?.rows ?? body?.input);
  return buildChatPrompt(String(body?.prompt || ''), rows, Number(body?.sampleSize) || 40);
}

export function registerProviderRoutes(app: Express): void {
  app.post('/api/openrouter/complete', async (req, res) => {
    const config = mergedConfig<OpenRouterConfig>('openrouter', req.body?.config);
    if (!assertConfigured('openrouter', config, res)) return;

    try {
      const request = buildOpenRouterRequest(config, chatContent(req.body), {
        model: req.body?.model,
        systemPrompt: req.body?.systemPrompt,
      });

      const response = await probe(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const detail = payload?.error?.message || payload?.message;
        return res.status(response.status).json({
          error: detail ? `OpenRouter: ${detail}` : `OpenRouter request failed (${response.status}).`,
        });
      }

      const text = extractCompletionText(payload);
      if (text === null) {
        return res.status(502).json({ error: 'OpenRouter returned no completion text.' });
      }

      res.json({
        source: 'openrouter',
        text,
        model: payload?.model ?? request.body.model,
        usage: payload?.usage ?? null,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('OpenRouter error:', err);
      res.status(errorStatus(err)).json({ error: err?.message || 'OpenRouter request failed.' });
    }
  });

  app.post('/api/huggingface/complete', async (req, res) => {
    const config = mergedConfig<HuggingFaceConfig>('huggingface', req.body?.config);
    if (!assertConfigured('huggingface', config, res)) return;

    try {
      const request = buildHuggingFaceRequest(config, chatContent(req.body), { model: req.body?.model });

      const response = await probe(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const detail = payload?.error?.message || payload?.error || payload?.message;
        return res.status(response.status).json({
          error: detail ? `Hugging Face: ${detail}` : `Hugging Face request failed (${response.status}).`,
        });
      }

      const text = extractCompletionText(payload);
      if (text === null) {
        return res.status(502).json({ error: 'Hugging Face returned no text in its response.' });
      }

      res.json({
        source: 'huggingface',
        text,
        model: req.body?.model || config.model || null,
        endpoint: request.url,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Hugging Face error:', err);
      res.status(errorStatus(err)).json({ error: err?.message || 'Hugging Face request failed.' });
    }
  });

  app.post('/api/opencode/prompt', async (req, res) => {
    const config = mergedConfig<OpencodeConfig>('opencode', req.body?.config);
    if (!assertConfigured('opencode', config, res)) return;

    try {
      const request = buildOpencodeRequest(config, chatContent(req.body), { model: req.body?.model });

      // Reuse a session when the node already has one, so a chain of prompts
      // keeps its context.
      let sessionId = String(req.body?.sessionId || '').trim();
      if (!sessionId) {
        const created = await probe(request.sessionUrl, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({}),
        });
        const createdPayload = await readJsonResponse(created);
        if (!created.ok) {
          return res.status(created.status).json({
            error: `opencode: could not create a session (${created.status}). ${
              typeof createdPayload === 'string' ? createdPayload : JSON.stringify(createdPayload ?? {})
            }`.trim(),
          });
        }
        sessionId = String(createdPayload?.id || createdPayload?.sessionID || '').trim();
        if (!sessionId) {
          return res.status(502).json({ error: 'opencode: the server returned a session without an id.' });
        }
      }

      const response = await probe(request.messageUrl(sessionId), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const detail = typeof payload === 'string' ? payload : payload?.message || payload?.error;
        return res.status(response.status).json({
          error: detail ? `opencode: ${detail}` : `opencode request failed (${response.status}).`,
        });
      }

      res.json({
        source: 'opencode',
        sessionId,
        text: extractOpencodeText(payload),
        raw: payload,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('opencode error:', err);
      res.status(errorStatus(err)).json({ error: err?.message || 'opencode request failed.' });
    }
  });

  /**
   * One MCP JSON-RPC exchange over Streamable HTTP. Every call re-runs
   * `initialize` because this proxy holds no connection between requests;
   * that is a handshake, not a per-call cost the user configures.
   */
  app.post('/api/mcp/rpc', async (req, res) => {
    const config = mergedConfig<McpConfig>('mcp', req.body?.config);
    if (!assertConfigured('mcp', config, res)) return;

    const method = String(req.body?.method || 'tools/list');
    if (!['tools/list', 'tools/call'].includes(method)) {
      return res.status(400).json({ error: `MCP: unsupported method "${method}".` });
    }

    try {
      const init = buildMcpRequest(config, 'initialize', mcpInitializeParams(), 1);
      const initResponse = await probe(init.url, {
        method: 'POST',
        headers: init.headers,
        body: JSON.stringify(init.body),
      });
      const initText = await initResponse.text();

      if (!initResponse.ok) {
        return res.status(initResponse.status).json({
          error: `MCP: initialize failed (${initResponse.status}). ${initText.slice(0, 300)}`.trim(),
        });
      }

      const initPayload = parseMcpResponseBody(initText);
      if (initPayload?.error) {
        return res.status(502).json({ error: `MCP: ${initPayload.error?.message || 'initialize was rejected.'}` });
      }

      const sessionId = initResponse.headers.get('mcp-session-id') || undefined;

      // Streamable HTTP servers expect the initialized notification before use.
      const notify = buildMcpRequest(config, 'notifications/initialized', {}, 2, sessionId);
      try {
        await probe(notify.url, {
          method: 'POST',
          headers: notify.headers,
          body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
        });
      } catch {
        // Servers that ignore the notification still answer calls.
      }

      const params = method === 'tools/call'
        ? { name: String(req.body?.tool || ''), arguments: req.body?.arguments ?? {} }
        : {};

      if (method === 'tools/call' && !params.name) {
        return res.status(400).json({ error: 'MCP: name the tool to call.' });
      }

      const call = buildMcpRequest(config, method, params, 3, sessionId);
      const response = await probe(call.url, {
        method: 'POST',
        headers: call.headers,
        body: JSON.stringify(call.body),
      });
      const text = await response.text();

      if (!response.ok) {
        return res.status(response.status).json({
          error: `MCP: ${method} failed (${response.status}). ${text.slice(0, 300)}`.trim(),
        });
      }

      const payload = parseMcpResponseBody(text);
      if (payload?.error) {
        return res.status(502).json({ error: `MCP: ${payload.error?.message || 'the server returned an error.'}` });
      }

      if (method === 'tools/list') {
        const rows = normalizeMcpTools(payload);
        return res.json({
          source: 'mcp',
          method,
          rows,
          count: rows.length,
          serverInfo: initPayload?.result?.serverInfo ?? null,
          fetchedAt: new Date().toISOString(),
        });
      }

      const { text: resultText, structured } = extractMcpCallResult(payload);
      res.json({
        source: 'mcp',
        method,
        tool: params.name,
        text: resultText,
        structured,
        isError: Boolean(payload?.result?.isError),
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('MCP error:', err);
      res.status(errorStatus(err)).json({ error: err?.message || 'MCP request failed.' });
    }
  });

  /** Lists files in the configured Drive folder as rows. */
  app.post('/api/drive/files', async (req, res) => {
    const config = mergedConfig<DriveConfig>('drive', req.body?.config);

    const accessToken = String(req.body?.accessToken || config.accessToken || '').trim();
    if (!accessToken) {
      return res.status(401).json({
        error: 'Google Drive: sign in with Google under Connections & APIs first.',
      });
    }

    try {
      const folderId = String(config.folderId || '').trim();
      const params = new URLSearchParams();
      params.set('fields', 'files(id,name,mimeType,modifiedTime,size,webViewLink)');
      params.set('pageSize', String(Math.min(Number(req.body?.pageSize) || 25, 100)));
      params.set('orderBy', 'modifiedTime desc');

      const clauses = ['trashed = false'];
      if (folderId) clauses.push(`'${folderId.replace(/'/g, "\\'")}' in parents`);
      const search = String(req.body?.query || '').trim();
      if (search) clauses.push(`name contains '${search.replace(/'/g, "\\'")}'`);
      params.set('q', clauses.join(' and '));

      const response = await probe(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const detail = payload?.error?.message;
        return res.status(response.status).json({
          error: detail ? `Google Drive: ${detail}` : `Google Drive request failed (${response.status}).`,
        });
      }

      const rows = Array.isArray(payload?.files)
        ? payload.files.map((file: any) => ({
            id: file?.id ?? null,
            name: file?.name ?? null,
            mime_type: file?.mimeType ?? null,
            modified_time: file?.modifiedTime ?? null,
            size_bytes: file?.size ? Number(file.size) : null,
            link: file?.webViewLink ?? null,
          }))
        : [];

      res.json({
        source: 'drive',
        rows,
        count: rows.length,
        folderId: folderId || null,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Drive list error:', err);
      res.status(errorStatus(err)).json({ error: err?.message || 'Failed to list Drive files.' });
    }
  });
}
