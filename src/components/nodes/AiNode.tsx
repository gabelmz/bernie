import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { AiNodeData } from '../../types';
import { Sparkles, MessageSquare } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function AiNode({ data, id }: NodeProps & { data: AiNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(data.prompt || '');

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData: data.inputData || { text: "No input data provided" },
          prompt: prompt
        })
      });
      const result = await res.json();
      
      if (res.ok) {
        if (data.onDataFetched) {
          data.onDataFetched(id, result.result);
        }
      } else {
        throw new Error(result.error || "Failed to execute AI");
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
      runAnalysis();
    }
  }, [data.status]);

  return (
    <div className="min-w-[300px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'AI Agent'} 
          icon={<Sparkles className="w-4 h-4 text-purple-400" />} 
          badge="logic"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted flex items-center gap-1 uppercase tracking-widest">
              <MessageSquare className="w-3.5 h-3.5" /> Prompt Instruction
            </label>
            <div className="text-[15px] border border-border/50 rounded p-0 bg-surface/50 text-text-main leading-relaxed shadow-inner">
              <textarea
                className="w-full h-full min-h-[60px] bg-transparent outline-none p-3 resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Summarize the input data..."
              />
            </div>
          </div>

          <button 
            onClick={runAnalysis}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Thinking...' : 'Run Analysis'}
          </button>

          {error && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{error}</div>}

          {data.result && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">Output</label>
              <div className="text-[13px] bg-surface/50 p-3 rounded border border-border/50 text-text-main leading-relaxed max-h-40 overflow-y-auto shadow-inner">
                {typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2)}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
