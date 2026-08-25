import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { HttpNodeData } from '../../types';
import { Play, Globe, Code2, Wand2, X } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function HttpNode({ data, id }: NodeProps & { data: HttpNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [snippet, setSnippet] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const { updateNodeData } = useReactFlow();

  const handleParse = async () => {
    if (!snippet.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/parse-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet })
      });
      const parsed = await res.json();
      
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      updateNodeData(id, {
        url: parsed.url || data.url,
        method: parsed.method || data.method,
        headers: parsed.headers || data.headers,
        requestBody: parsed.body || data.requestBody
      });
      
      setIsImporting(false);
      setSnippet('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const runRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: data.url,
          method: data.method,
          headers: data.headers,
          body: data.requestBody || data.inputData
        })
      });
      const result = await res.json();
      
      if (data.onDataFetched) {
        data.onDataFetched(id, result.data || result);
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
      runRequest();
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
          title={data.title || 'HTTP Request'} 
          icon={<Globe className="w-4 h-4 text-emerald-500" />} 
          badge="http"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          
          <div className="flex justify-between items-center px-1">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Endpoint URL</label>
            <button 
              onClick={() => setIsImporting(!isImporting)}
              className="text-[11px] flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold uppercase tracking-widest transition-colors"
            >
              <Wand2 className="w-3 h-3" /> 
              Import
            </button>
          </div>

          {isImporting && (
            <div className="bg-surface/50 border border-indigo-500/30 rounded p-2 flex flex-col gap-2 mb-1 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-text-muted">Paste cURL, JS fetch, Python requests, or OpenAPI...</span>
                <button onClick={() => setIsImporting(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <textarea 
                value={snippet}
                onChange={(e) => setSnippet(e.target.value)}
                placeholder={'curl -X POST https://api.example.com -d \'{"hello": "world"}\''}
                className="w-full h-20 bg-card border border-border/50 rounded text-[13px] p-2 text-text-main font-mono focus:outline-none focus:border-indigo-500 resize-none"
              />
              <button 
                onClick={handleParse}
                disabled={isParsing || !snippet.trim()}
                className="w-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:text-indigo-300 py-1.5 rounded text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isParsing ? 'Parsing...' : 'Parse Snippet'}
              </button>
            </div>
          )}

          <div className="flex items-center text-[15px] border border-border/50 rounded overflow-hidden bg-surface/50">
            <input 
              value={data.method || 'GET'} 
              onChange={e => updateNodeData(id, { method: e.target.value })}
              className="bg-transparent w-20 px-2 py-2 font-medium text-emerald-400 border-r border-border/50 focus:outline-none"
            />
            <input 
              value={data.url || ''} 
              onChange={e => updateNodeData(id, { url: e.target.value })}
              placeholder="https://api.example.com"
              className="px-3 py-2 flex-1 bg-transparent text-text-main font-mono text-[13px] focus:outline-none truncate w-full"
            />
          </div>

          {(data.headers && Object.keys(data.headers).length > 0) && (
            <div className="mt-1">
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest block mb-1">Headers</label>
              <pre className="text-[11px] bg-surface/50 p-2 rounded border border-border/50 overflow-x-auto font-mono text-text-muted">
                {JSON.stringify(data.headers, null, 2)}
              </pre>
            </div>
          )}
          
          {data.requestBody && (
            <div className="mt-1">
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest block mb-1">Body</label>
              <pre className="text-[11px] bg-surface/50 p-2 rounded border border-border/50 overflow-x-auto font-mono text-text-muted">
                {typeof data.requestBody === 'string' ? data.requestBody : JSON.stringify(data.requestBody, null, 2)}
              </pre>
            </div>
          )}

          <button 
            onClick={runRequest}
            disabled={loading || !data.url}
            className="w-full mt-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Sending...' : 'Run Request'}
          </button>

          {error && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded break-all">{error}</div>}

          {data.response && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 flex items-center gap-1 uppercase tracking-widest">
                <Code2 className="w-3 h-3" /> Response Data
              </label>
              <pre className="text-[11px] bg-surface/50 p-3 rounded border border-border/50 max-h-32 overflow-y-auto font-mono text-text-muted shadow-inner">
                {JSON.stringify(data.response, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
