import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { SheetsNodeData } from '../../types';
import { Table, Play, Database, AlertTriangle, Settings, CheckCircle2 } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { toRows } from '../../lib/integrationCore';
import { postJson } from '../../lib/nodeApi';
import { getAccessToken } from '../../lib/firebase';

/**
 * Sink node: pushes the rows arriving on its input into a Google Sheets tab.
 * The write itself runs server-side so header building and error handling match
 * the other sinks; the OAuth token comes from the connected Google account
 * unless the Sheets integration config overrides it.
 */
export function SheetNode({ data, id }: NodeProps & { data: SheetsNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState(data.spreadsheetId || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(
    () =>
      configFor('sheets', {
        spreadsheetId: spreadsheetId || undefined,
        sheetName: data.sheetName,
        mode: data.mode,
        includeHeaders: data.includeHeaders,
      }),
    [spreadsheetId, data.sheetName, data.mode, data.includeHeaders]
  );

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker('sheets', buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [buildConfig]);

  const runExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = buildConfig();
      const rows = toRows(data.inputData);
      if (rows.length === 0) {
        throw new Error('No input rows. Connect a source node and run it first.');
      }

      // An explicit token in the integration config wins; otherwise use the
      // token from the Google account connected in the sidebar.
      let accessToken = String(config.accessToken || '').trim();
      if (!accessToken) {
        accessToken = (await getAccessToken()) || '';
      }
      if (!accessToken) {
        throw new Error('Not authenticated with Google. Connect Workspace in the sidebar.');
      }

      const result = await postJson('/api/sheets/rows', { config, rows, accessToken });
      data.onDataFetched?.(id, {
        success: true,
        spreadsheetId: result.spreadsheetId,
        sheetName: result.sheetName,
        mode: result.mode,
        written: result.written,
        updatedRange: result.updatedRange,
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
      runExport();
    }
  }, [data.status]);

  const config = buildConfig();
  const pendingRows = toRows(data.inputData).length;
  const result = data.mappedData && typeof data.mappedData === 'object' ? (data.mappedData as any) : null;

  return (
    <div className="min-w-[280px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'Google Sheets'}
          icon={<Table className="w-4 h-4 text-green-500" />}
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
              <Database className="w-3 h-3" /> {pendingRows} row{pendingRows === 1 ? '' : 's'} ready to export
            </div>
          )}

          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Spreadsheet ID</label>
            <input
              type="text"
              placeholder="Defaults to Integrations setting"
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-green-500/50"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
            <p className="text-[11px] text-text-muted">
              {config.sheetName || 'Sheet1'} · {config.mode === 'overwrite' ? 'overwrite from A1' : 'append rows'}
              {config.includeHeaders !== false ? ' · with headers' : ''}
            </p>
          </div>

          <button
            onClick={runExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Exporting...' : 'Push Rows to Sheet'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{data.errorMessage || error}</span>
            </div>
          )}

          {result?.success && (
            <div className="mt-1 pt-3 border-t border-border/50 text-[13px] text-green-400 bg-green-950/30 p-2 rounded flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Wrote {result.written} row{result.written === 1 ? '' : 's'}
                {result.updatedRange ? ` to ${result.updatedRange}` : ''}
              </span>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
