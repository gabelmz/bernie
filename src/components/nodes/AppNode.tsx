import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Eye, KeyRound, Play, Wrench, Zap } from 'lucide-react';
import { AppNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { INTEGRATION_SCHEMAS, IntegrationId, toRows } from '../../lib/integrationCore';
import { INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { OperationDirection, operationsFor, resolveOperation } from '../../lib/operations';
import { previewColumns } from '../../lib/operationEngine';
import { legacyOperationFor, legacyParamsFor, missingCredentials, nodeConfigFor } from '../../lib/nodeConfig';
import { postJson } from '../../lib/nodeApi';
import { getAccessToken } from '../../lib/auth';

const DIRECTION_ICONS: Record<OperationDirection, ReactNode> = {
  pull: <ArrowDownToLine className="w-3 h-3" />,
  push: <ArrowUpFromLine className="w-3 h-3" />,
  preview: <Eye className="w-3 h-3" />,
  mutate: <Zap className="w-3 h-3" />,
  raw: <Wrench className="w-3 h-3" />,
};

/** Integrations whose calls are authorized by the Google sign-in token. */
const GOOGLE_BACKED: IntegrationId[] = ['sheets', 'drive'];

interface AppNodeProps extends NodeProps {
  data: AppNodeData;
  integration: IntegrationId;
  icon: ReactNode;
  /** Border colour for the focused operation picker. */
  focusClass: string;
  /** Background colour for the run button. */
  buttonClass: string;
}

/**
 * One node per app, scoped to a chosen operation. The operation list, the
 * fields it needs and how its result is shaped all come from the operation
 * registry, so pull, push and preview live in the same node rather than in
 * separate single-purpose ones.
 */
export function AppNode({ data, id, integration, icon, focusClass, buttonClass }: AppNodeProps) {
  const { updateNodeData } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  // Per-run detail worth showing but not worth persisting on the node.
  const [lastMeta, setLastMeta] = useState<Record<string, any> | null>(null);

  const schema = INTEGRATION_SCHEMAS[integration];
  const operations = useMemo(() => operationsFor(integration), [integration]);
  // Canvases saved before app-scoped nodes stored their settings as flat
  // fields; fold those in so an old node still runs. Explicit params win.
  const params = useMemo(
    () => ({ ...legacyParamsFor(integration, data as any), ...(data.params || {}) }),
    [integration, data]
  );
  const spec = useMemo(
    () => resolveOperation(integration, data.operation || legacyOperationFor(integration, data as any)),
    [integration, data]
  );

  const nodeInput = useMemo(
    () => ({ credentials: data.credentials, params }),
    [data.credentials, params]
  );

  useEffect(() => {
    const refresh = () => setMissing(missingCredentials(integration, nodeInput));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [integration, nodeInput]);

  const run = useCallback(async () => {
    if (!spec) return;
    setLoading(true);
    setError(null);
    try {
      // Google's APIs authorize with the sign-in token rather than a stored key.
      const accessToken = GOOGLE_BACKED.includes(integration) ? (await getAccessToken()) || undefined : undefined;

      const result = await postJson('/api/integrations/execute', {
        integration,
        operation: spec.id,
        config: nodeConfigFor(integration, nodeInput),
        params,
        rows: toRows(data.inputData),
        accessToken,
      });

      // Row-shaped results flow on as rows; anything else flows on whole.
      const output =
        spec.emitsRows && (result.rows?.length || !result.text)
          ? result.rows ?? []
          : { text: result.text, data: result.data, meta: result.meta };

      // Canvas owns node data via useNodesState, so results go through the one
      // writer it provides. Writing here with updateNodeData as well would
      // race it and silently drop whichever landed first.
      data.onDataFetched?.(id, output);
      setLastMeta(result.meta ?? null);
    } catch (err: any) {
      setError(err.message);
      data.onDataFetched?.(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [spec, integration, nodeInput, params, data, id]);

  useEffect(() => {
    if (data.status === 'running') {
      run();
    }
  }, [data.status]);

  const setOperation = (operationId: string) => {
    setError(null);
    updateNodeData(id, { operation: operationId });
  };

  const rows: Record<string, any>[] = Array.isArray(data.jsonData) ? data.jsonData : [];
  const payload = !Array.isArray(data.jsonData) && data.jsonData && typeof data.jsonData === 'object'
    ? (data.jsonData as any)
    : null;
  const outputText: string | null = typeof payload?.text === 'string' ? payload.text : null;
  const columns = previewColumns(rows, 4);
  const pendingRows = toRows(data.inputData).length;

  // Only the fields worth a line of text; the rest stays in the payload.
  const metaNote = (() => {
    if (!lastMeta) return null;
    const parts: string[] = [];
    if (lastMeta.tokensLeft !== undefined && lastMeta.tokensLeft !== null) parts.push(`${lastMeta.tokensLeft} Keepa tokens left`);
    if (lastMeta.serverInfo?.name) parts.push(`server ${lastMeta.serverInfo.name}`);
    if (lastMeta.written !== undefined) parts.push(`${lastMeta.written} written`);
    if (lastMeta.previewed !== undefined) parts.push(`previewed ${lastMeta.previewed}${lastMeta.truncated ? ' (truncated)' : ''}`);
    if (lastMeta.sessionId) parts.push(`session ${lastMeta.sessionId}`);
    if (lastMeta.model) parts.push(String(lastMeta.model));
    return parts.length ? parts.join(' · ') : null;
  })();

  return (
    <div className="min-w-[340px] max-w-[420px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || schema?.name || integration}
          icon={icon}
          badge={spec?.direction || 'app'}
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {missing.length > 0 && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Needs {missing.join(', ')}. Add it in this node's Edit pane, or once under Connections &amp; APIs.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Operation</label>
            <select
              value={spec?.id || ''}
              onChange={(e) => setOperation(e.target.value)}
              className={`w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none ${focusClass}`}
            >
              {operations.map((operation) => (
                <option key={operation.id} value={operation.id}>
                  {operation.label}
                </option>
              ))}
            </select>
            {spec && (
              <p className="text-[11px] text-text-muted leading-relaxed flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">{DIRECTION_ICONS[spec.direction]}</span>
                <span>{spec.summary}</span>
              </p>
            )}
          </div>

          {spec?.consumesRows && (
            <div
              className={`text-[12px] p-2 rounded border ${
                pendingRows > 0
                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
                  : 'bg-surface/60 border-border/50 text-text-muted'
              }`}
            >
              {pendingRows > 0
                ? `${pendingRows} input row${pendingRows === 1 ? '' : 's'} ready`
                : 'Waiting for input rows'}
            </div>
          )}

          <button
            onClick={run}
            disabled={loading || !spec}
            className={`w-full flex items-center justify-center gap-2 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide ${buttonClass}`}
          >
            <Play className="w-4 h-4" />
            {loading ? 'Running...' : spec?.label || 'Run'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {rows.length > 0 && columns.length > 0 && (
            <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-text-muted uppercase tracking-widest">
                <span>Preview</span>
                <span>
                  {rows.length} row{rows.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="overflow-x-auto rounded border border-border/50">
                <table className="w-full text-[11px]">
                  <thead className="bg-surface/60">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="text-left font-semibold text-text-muted px-2 py-1 whitespace-nowrap">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t border-border/40">
                        {columns.map((column) => (
                          <td
                            key={column}
                            className="px-2 py-1 text-text-main max-w-[120px] truncate"
                            title={String(row?.[column] ?? '')}
                          >
                            {formatCell(row?.[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p className="text-[11px] text-text-muted">Showing 5 of {rows.length}.</p>
              )}
              {metaNote && <p className="text-[11px] text-text-muted">{metaNote}</p>}
            </div>
          )}

          {outputText && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">
                Output
              </label>
              <div className="text-[13px] bg-surface/50 p-3 rounded border border-border/50 text-text-main leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                {outputText}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}

function formatCell(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
