import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AlertTriangle, Play, Settings } from 'lucide-react';
import { CompletionNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { IntegrationId, toRows } from '../../lib/integrationCore';
import { postJson } from '../../lib/nodeApi';

interface CompletionNodeProps extends NodeProps {
  data: CompletionNodeData;
  /** Which saved integration config this node runs on. */
  integration: Extract<IntegrationId, 'openrouter' | 'huggingface' | 'opencode'>;
  endpoint: string;
  defaultTitle: string;
  icon: ReactNode;
  buttonClass: string;
  focusClass: string;
  runLabel: string;
  modelPlaceholder: string;
}

/**
 * Shared body for the text-completion nodes (OpenRouter, Hugging Face,
 * opencode). They differ only in which config they read, which endpoint they
 * post to, and their colours, so the request/response handling lives here once.
 */
export function CompletionNode({
  data,
  id,
  integration,
  endpoint,
  defaultTitle,
  icon,
  buttonClass,
  focusClass,
  runLabel,
  modelPlaceholder,
}: CompletionNodeProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(
    () => configFor(integration, { model: data.model } as any),
    [integration, data.model]
  );

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker(integration, buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [integration, buildConfig]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await postJson(endpoint, {
        config: buildConfig(),
        prompt,
        rows: toRows(data.inputData),
        model: data.model,
        systemPrompt: data.systemPrompt,
        sampleSize: data.sampleSize,
        // opencode threads a session so successive prompts keep context.
        sessionId: data.sessionId,
      });

      data.onDataFetched?.(id, {
        text: result.text,
        model: result.model ?? null,
        sessionId: result.sessionId ?? null,
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
      run();
    }
  }, [data.status]);

  const config = buildConfig() as Record<string, any>;
  const pendingRows = toRows(data.inputData).length;
  const payload = data.jsonData && typeof data.jsonData === 'object' ? (data.jsonData as any) : null;
  const output: string | null = typeof payload?.text === 'string' ? payload.text : null;

  return (
    <div className="min-w-[320px] max-w-[400px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader title={data.title || defaultTitle} icon={icon} badge="ai" backgroundColor={data.backgroundColor} />

        <div className="p-2 flex flex-col gap-2">
          {blocker && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <Settings className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blocker}</span>
            </div>
          )}

          {pendingRows > 0 && (
            <div className="text-[12px] bg-surface/60 border border-border/50 p-2 rounded text-text-muted">
              {pendingRows} input row{pendingRows === 1 ? '' : 's'} will be sent with the prompt
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Prompt</label>
            <textarea
              className={`w-full min-h-[60px] bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none resize-y ${focusClass}`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Summarize the input data..."
            />
            <p className="text-[11px] text-text-muted truncate">
              {config.model || `No model set (${modelPlaceholder})`}
            </p>
          </div>

          <button
            onClick={run}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide ${buttonClass}`}
          >
            <Play className="w-4 h-4" />
            {loading ? 'Running...' : runLabel}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {output && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">
                Output
              </label>
              <div className="text-[13px] bg-surface/50 p-3 rounded border border-border/50 text-text-main leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                {output}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
