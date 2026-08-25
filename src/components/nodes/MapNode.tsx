import { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Map } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function MapNode({ data, id }: NodeProps & { data: any }) {
  return (
    <div className="min-w-[240px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Map'} 
          icon={<Map className="w-4 h-4 text-text-muted" />} 
          badge="map"
          backgroundColor={data.backgroundColor}
        />
        <div className="p-3 text-[12px] text-text-muted flex flex-col gap-2">
           <div className="bg-green-500/10 border-green-500/30 p-2 rounded flex items-center justify-center border">
              Configured via Edit Pane
           </div>
           {data.lastResult && (
             <div className="mt-2 text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded truncate">
               {typeof data.lastResult === 'string' ? data.lastResult : JSON.stringify(data.lastResult)}
             </div>
           )}
        </div>
      </NodeWrapper>
    </div>
  );
}