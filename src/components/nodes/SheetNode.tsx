import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { SheetNodeData } from '../../types';
import { Table, Play, Database } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function SheetNode({ data, id }: NodeProps & { data: SheetNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState(data.spreadsheetId || '');

  const runExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await (await import('../../lib/firebase')).getAccessToken();
      if (!token) throw new Error("Not authenticated with Google. Connect Workspace in the sidebar.");
      if (!spreadsheetId) throw new Error("Please provide a Spreadsheet ID");

      const sheetName = data.sheetName || 'Sheet1';
      const inputData = data.inputData;
      
      let values = [];
      if (Array.isArray(inputData)) {
        if (inputData.length > 0 && typeof inputData[0] === 'object') {
           const headers = Object.keys(inputData[0]);
           values.push(headers);
           for (const row of inputData) {
             values.push(headers.map(h => {
               const val = row[h];
               return typeof val === 'object' ? JSON.stringify(val) : val;
             }));
           }
        } else {
           values = [inputData];
        }
      } else if (typeof inputData === 'object' && inputData !== null) {
        values = [Object.keys(inputData), Object.values(inputData).map(v => typeof v === 'object' ? JSON.stringify(v) : v)];
      } else {
        values = [[inputData || "Test Output"]];
      }

      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `${sheetName}!A1`,
          majorDimension: 'ROWS',
          values: values
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to export to Google Sheets");
      }

      const resData = await res.json();
      const output = { success: true, updatedRange: resData.updates?.updatedRange, message: `Exported to Sheet: ${sheetName}` };
      
      if (data.onDataFetched) {
        data.onDataFetched(id, output);
      }
    } catch (err: any) {
      setError(err.message);
      if (data.onDataFetched) {
        data.onDataFetched(id, { error: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      runExport();
    }
  }, [data.status]);

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
          badge="export"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          {data.inputData && (
            <div className="text-[13px] bg-emerald-950/30 border border-emerald-900/50 p-2 rounded text-emerald-400 flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Data ready to export
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Spreadsheet ID</label>
            <input 
              type="text"
              placeholder="e.g. 1BxiMVs0XRY..."
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-green-500/50"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
            />
          </div>
          <button 
            onClick={runExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Exporting...' : 'Export to Sheet'}
          </button>
          
          {data.status === 'error' && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{data.errorMessage || error}</div>}
          
          {data.mappedData && (
            <div className="mt-1 pt-3 border-t border-border/50 text-[13px] text-green-400 bg-green-950/30 p-2 rounded text-center">
              Successfully exported!
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
