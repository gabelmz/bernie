import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Database, Play, AlertTriangle, Settings, CheckCircle2 } from 'lucide-react';
import { SupabaseNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { toRows } from '../../lib/integrationCore';
import { postJson } from '../../lib/nodeApi';

/**
 * Sink node: writes the rows arriving on its input into a Supabase table via
 * the REST API, in insert or upsert mode.
 */
export function SupabaseNode({ data, id }: NodeProps & { data: SupabaseNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState(data.table || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(
    () =>
      configFor('supabase', {
        table: table || undefined,
        mode: data.mode,
        onConflict: data.onConflict,
      }),
    [table, data.mode, data.onConflict]
  );

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker('supabase', buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [buildConfig]);

  const runWrite = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = toRows(data.inputData);
      if (rows.length === 0) {
        throw new Error('No input rows. Connect a source node and run it first.');
      }

      const result = await postJson('/api/supabase/rows', { config: buildConfig(), rows });
      data.onDataFetched?.(id, {
        success: true,
        table: result.table,
        mode: result.mode,
        written: result.written,
        writtenAt: result.writtenAt,
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
      runWrite();
    }
  }, [data.status]);

  const config = buildConfig();
  const pendingRows = toRows(data.inputData).length;
  const result = data.jsonData && typeof data.jsonData === 'object' ? (data.jsonData as any) : null;

  return (
    <div className="min-w-[300px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'Supabase'}
          icon={<Database className="w-4 h-4 text-emerald-500" />}
          badge="sink"
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {blocker && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <Settings className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blocker}</span>
            </div>
          )}

          {pendingRows > 0 && (
            <div className="text-[13px] bg-emerald-950/30 border border-emerald-900/50 p-2 rounded text-emerald-400 flex items-center gap-1.5">
              <Database className="w-3 h-3" /> {pendingRows} row{pendingRows === 1 ? '' : 's'} ready to write
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Table</label>
            <input
              type="text"
              placeholder="Defaults to Integrations setting"
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-emerald-500/50 font-mono"
              value={table}
              onChange={(e) => setTable(e.target.value)}
            />
            <p className="text-[11px] text-text-muted">
              Mode: {config.mode === 'upsert' ? `upsert on ${config.onConflict || '(set a conflict column)'}` : 'insert'}
            </p>
          </div>

          <button
            onClick={runWrite}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-1"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Writing rows...' : 'Push Rows'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {result?.success && (
            <div className="mt-1 pt-3 border-t border-border/50 text-[13px] text-emerald-400 bg-emerald-950/30 p-2 rounded flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Wrote {result.written} row{result.written === 1 ? '' : 's'} to {result.table} ({result.mode})
              </span>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
