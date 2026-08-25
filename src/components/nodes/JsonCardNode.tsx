import { useEffect, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { JsonNodeData } from '../../types';
import { Code2 } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { RawJsonEditor } from './JsonEditor';

export function JsonCardNode({ data, id }: NodeProps & { data: JsonNodeData }) {
  const { updateNodeData } = useReactFlow();
  const [localCode, setLocalCode] = useState(JSON.stringify(data.jsonData || {}, null, 2));

  useEffect(() => {
    if (data.status === 'running') {
      if (data.onDataFetched) {
        data.onDataFetched(id, data.jsonData);
      }
    }
  }, [data.status]);

  const handleJsonChange = (newCode: string, parsed: any, error: string | null) => {
    setLocalCode(newCode);
    if (!error && parsed !== null) {
      updateNodeData(id, { jsonData: parsed });
    }
  };

  return (
    <div className="min-w-[300px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'JSON Data'} 
          icon={<Code2 className="w-4 h-4 text-text-muted" />} 
          badge="json"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="flex flex-col">
          <RawJsonEditor 
             value={localCode} 
             onChange={handleJsonChange} 
          />
        </div>
      </NodeWrapper>
    </div>
  );
}
