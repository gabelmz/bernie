import { Handle, Position, NodeProps } from '@xyflow/react';
import { CustomNodeData } from '../../types';
import { Box } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function CustomNode({ data, id }: NodeProps & { data: CustomNodeData }) {
  return (
    <div className="min-w-[250px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Custom'} 
          icon={<Box className="w-4 h-4 text-pink-400" />} 
          badge="custom"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <div className="text-[13px] text-text-muted text-center py-4 border border-dashed border-border/50 bg-surface/50 rounded">
            Custom Node Implementation
          </div>
        </div>
      </NodeWrapper>
    </div>
  );
}
