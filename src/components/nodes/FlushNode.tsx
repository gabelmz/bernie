import { useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FlushNodeData } from '../../types';
import { Trash2 } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function FlushNode({ data, id }: NodeProps & { data: FlushNodeData }) {
  useEffect(() => {
    if (data.status === 'running') {
      if (data.onDataFetched) {
        data.onDataFetched(id, data.inputData);
      }
    }
  }, [data.status]);

  return (
    <div className="min-w-[200px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Flush'} 
          icon={<Trash2 className="w-4 h-4 text-red-400" />} 
          badge="flush"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2 text-center">
          <p className="text-[13px] text-text-muted">Data sinks here.</p>
          {data.flushedData && (
            <div className="mt-1 pt-3 border-t border-border/50 text-left">
               <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">Last Received</label>
               <pre className="text-[11px] bg-surface/50 p-2 rounded border border-border/50 max-h-24 overflow-y-auto font-mono text-text-muted shadow-inner">
                 {typeof data.flushedData === 'object' ? JSON.stringify(data.flushedData, null, 2) : String(data.flushedData)}
               </pre>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
