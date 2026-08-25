import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { TextNodeData } from '../../types';
import { Type } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function TextNode({ data, id }: NodeProps & { data: TextNodeData }) {
  const [text, setText] = useState(data.text || '');

  useEffect(() => {
    if (data.status === 'running') {
      if (data.onDataFetched) {
        data.onDataFetched(id, { text });
      }
    }
  }, [data.status]);

  return (
    <div className="min-w-[250px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Text'} 
          icon={<Type className="w-4 h-4 text-blue-400" />} 
          badge="text"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <textarea 
            className="w-full bg-surface/50 border border-border/50 rounded p-3 text-[15px] text-text-main resize-none outline-none focus:border-blue-500/50 min-h-[80px]"
            value={text}
            placeholder="Enter text..."
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </NodeWrapper>
    </div>
  );
}
