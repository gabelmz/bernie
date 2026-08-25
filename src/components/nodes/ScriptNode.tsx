import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ScriptNodeData } from '../../types';
import { Terminal, Play } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function ScriptNode({ data, id }: NodeProps & { data: ScriptNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptVal, setScriptVal] = useState(data.script || '');

  const runScript = () => {
    setLoading(true);
    setError(null);
    try {
      // In a real app we would sandbox this. For demonstration, we use Function.
      // eslint-disable-next-line no-new-func
      const fn = new Function('input', scriptVal);
      const res = fn(data.inputData || { data: "sample input" }); // use real input if available
      if (data.onDataFetched) {
        data.onDataFetched(id, res);
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
      runScript();
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
          title={data.title || 'Script'} 
          icon={<Terminal className="w-4 h-4 text-yellow-400" />} 
          badge="script"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <textarea
              className="w-full bg-surface/50 border border-border/50 rounded p-3 text-[13px] text-yellow-200 font-mono resize-none outline-none focus:border-yellow-500/50 min-h-[100px]"
              value={scriptVal}
              onChange={(e) => setScriptVal(e.target.value)}
              placeholder="return input.data + ' processed';"
            />
          </div>

          <button 
            onClick={runScript}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Running...' : 'Run Script'}
          </button>

          {error && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{error}</div>}

          {data.result !== undefined && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">Output</label>
              <pre className="text-[11px] bg-surface/50 p-3 rounded border border-border/50 max-h-32 overflow-y-auto font-mono text-text-muted shadow-inner">
                {typeof data.result === 'object' ? JSON.stringify(data.result, null, 2) : String(data.result)}
              </pre>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
