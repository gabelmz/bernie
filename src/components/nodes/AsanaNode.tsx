import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { CheckCircle2, Play, AlertTriangle, Settings } from 'lucide-react';
import { AsanaNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { postJson } from '../../lib/nodeApi';

/**
 * Source node: pulls tasks out of Asana and emits them as normalized rows.
 * Node fields override the saved Asana integration config; blanks fall through.
 */
export function AsanaNode({ data, id }: NodeProps & { data: AsanaNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectGid, setProjectGid] = useState(data.projectGid || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(
    () =>
      configFor('asana', {
        projectGid: projectGid || undefined,
        workspaceGid: data.workspaceGid,
        assigneeGid: data.assigneeGid,
        includeCompleted: data.includeCompleted,
        limit: data.limit,
      }),
    [projectGid, data.workspaceGid, data.assigneeGid, data.includeCompleted, data.limit]
  );

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker('asana', buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [buildConfig]);

  const runPull = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await postJson('/api/asana/tasks', { config: buildConfig() });
      data.onDataFetched?.(id, result.rows ?? []);
    } catch (err: any) {
      setError(err.message);
      data.onDataFetched?.(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      runPull();
    }
  }, [data.status]);

  const rows: any[] = Array.isArray(data.jsonData) ? data.jsonData : [];

  return (
    <div className="min-w-[300px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'Asana Tasks'}
          icon={<CheckCircle2 className="w-4 h-4 text-rose-500" />}
          badge="source"
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {blocker && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <Settings className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blocker}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Project GID</label>
            <input
              type="text"
              placeholder="Defaults to Integrations setting"
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-rose-500/50"
              value={projectGid}
              onChange={(e) => setProjectGid(e.target.value)}
            />
            <p className="text-[11px] text-text-muted leading-relaxed">
              Filters, assignee and page size live in the Edit pane.
            </p>
          </div>

          <button
            onClick={runPull}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-1"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Pulling tasks...' : 'Pull Tasks'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1.5">
              <div className="text-[13px] text-rose-300 bg-rose-950/30 p-2 rounded">
                {rows.length} task{rows.length === 1 ? '' : 's'} ready
              </div>
              <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                {rows.slice(0, 6).map((row: any, index: number) => (
                  <div key={row?.gid || index} className="text-[12px] text-text-muted truncate px-1">
                    {row?.completed ? '✓' : '○'} {row?.name || '(untitled task)'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
