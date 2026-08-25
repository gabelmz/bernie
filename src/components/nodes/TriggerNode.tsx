import { Handle, Position, NodeProps } from '@xyflow/react';
import { TriggerNodeData } from '../../types';
import { Play } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function TriggerNode({ data, id }: NodeProps & { data: TriggerNodeData }) {
  return (
    <div className="min-w-[200px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Trigger'} 
          icon={<Play className="w-4 h-4 text-green-500" />} 
          badge="start"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <div className="text-[13px] text-text-muted text-center py-2">
            Entry point for workflow.
          </div>
          <button 
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors font-semibold text-[15px] tracking-wide"
            onClick={() => {
              if (data.runWorkflow) {
                data.runWorkflow(id);
              } else if (data.onDataFetched) { 
                data.onDataFetched(id, { triggeredAt: Date.now() });
              }
            }}
          >
            <Play className="w-4 h-4" />
            Run Workflow
          </button>
        </div>
      </NodeWrapper>
    </div>
  );
}
