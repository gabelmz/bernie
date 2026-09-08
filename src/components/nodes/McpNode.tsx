import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle, Play, Plug, Settings, Wrench } from 'lucide-react';
import { McpNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { postJson } from '../../lib/nodeApi';

/**
 * Talks to an MCP server over the Streamable HTTP transport: lists the tools it
 * exposes, or calls one with JSON arguments. Tool rows flow downstream like any
 * other source, and a call's text output flows on as `text`.
 */
export function McpNode({ data, id }: NodeProps & { data: McpNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState(data.tool || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(() => configFor('mcp'), []);

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker('mcp', buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [buildConfig]);

  const run = async (method: 'tools/list' | 'tools/call') => {
    setLoading(true);
    setError(null);
    try {
      let args: any = {};
      if (method === 'tools/call' && data.toolArguments) {
        if (typeof data.toolArguments === 'string') {
          try {
            args = JSON.parse(data.toolArguments);
          } catch {
            throw new Error('Tool arguments are not valid JSON.');
          }
        } else {
          args = data.toolArguments;
        }
      }

      const result = await postJson('/api/mcp/rpc', {
        config: buildConfig(),
        method,
        tool: method === 'tools/call' ? tool : undefined,
        arguments: args,
      });

      // A list emits rows; a call emits its text plus any structured content.
      data.onDataFetched?.(id, method === 'tools/list' ? result.rows ?? [] : {
        tool: result.tool,
        text: result.text,
        structured: result.structured,
        isError: result.isError,
      });
    } catch (err: any) {
      setError(err.message);
      data.onDataFetched?.(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      run(data.tool ? 'tools/call' : 'tools/list');
    }
  }, [data.status]);

  const config = buildConfig();
  const payload = data.jsonData;
  const toolRows: any[] = Array.isArray(payload) ? payload : [];
  const callResult = !Array.isArray(payload) && payload && typeof payload === 'object' ? (payload as any) : null;

  return (
    <div className="min-w-[320px] max-w-[400px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'MCP Server'}
          icon={<Plug className="w-4 h-4 text-blue-400" />}
          badge="tools"
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {blocker && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <Settings className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blocker}</span>
            </div>
          )}

          <p className="text-[11px] text-text-muted truncate" title={config.serverUrl || ''}>
            {config.serverUrl || 'No server URL set'}
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
              Tool (blank lists them)
            </label>
            <input
              type="text"
              placeholder="e.g. search_docs"
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-blue-400/50 font-mono"
              value={tool}
              onChange={(e) => setTool(e.target.value)}
            />
            <p className="text-[11px] text-text-muted">Arguments are set as JSON in the Edit pane.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => run('tools/list')}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border text-text-main hover:border-text-muted py-2 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[13px]"
            >
              <Wrench className="w-3.5 h-3.5" />
              List Tools
            </button>
            <button
              onClick={() => run('tools/call')}
              disabled={loading || !tool.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[13px]"
            >
              <Play className="w-3.5 h-3.5" />
              Call
            </button>
          </div>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {toolRows.length > 0 && (
            <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1">
              <div className="text-[13px] text-blue-300 bg-blue-950/30 p-2 rounded">
                {toolRows.length} tool{toolRows.length === 1 ? '' : 's'} available
              </div>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1 mt-1">
                {toolRows.slice(0, 8).map((row: any, index: number) => (
                  <button
                    key={row?.name || index}
                    onClick={() => setTool(row?.name || '')}
                    className="text-left text-[12px] text-text-muted hover:text-text-main px-2 py-1 rounded hover:bg-surface transition-colors truncate"
                    title={row?.description || row?.name}
                  >
                    <span className="font-mono text-text-main">{row?.name}</span>
                    {row?.description ? ` — ${row.description}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {callResult?.text && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">
                {callResult.isError ? 'Tool Error' : 'Result'}
              </label>
              <div
                className={`text-[13px] p-3 rounded border leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap ${
                  callResult.isError
                    ? 'bg-red-950/30 border-red-900/50 text-red-300'
                    : 'bg-surface/50 border-border/50 text-text-main'
                }`}
              >
                {callResult.text}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
