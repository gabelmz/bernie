import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { useReactFlow } from '@xyflow/react';

export function RawJsonEditor({ value, onChange }: { value: string, onChange: (val: string, parsed: any | null, error: string | null) => void }) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (newCode: string) => {
    try {
      const parsed = JSON.parse(newCode);
      setError(null);
      onChange(newCode, parsed, null);
    } catch (err: any) {
      setError(err.message);
      onChange(newCode, null, err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-surface h-full min-h-[250px]">
      <div className="flex-1 bg-card border-none relative font-mono text-[13px] overflow-hidden">
        <Editor
          value={value}
          onValueChange={handleChange}
          highlight={code => Prism.highlight(code, Prism.languages.json, 'json')}
          padding={12}
          className="editor-container h-full w-full min-h-[250px]"
          style={{
            fontFamily: '"Familjen Grotesk", monospace',
            minHeight: '100%',
            backgroundColor: 'transparent',
            outline: 'none',
          }}
        />
      </div>
      {error && (
        <div className="text-[11px] text-red-400 bg-red-950/30 p-2 mx-2 mb-2 rounded border border-red-900/50 break-all">
          Invalid JSON: {error}
        </div>
      )}
    </div>
  );
}

interface JsonEditorProps {
  nodeId: string;
  data: any;
}

export function JsonEditor({ nodeId, data }: JsonEditorProps) {
  const { updateNodeData } = useReactFlow();
  
  // Strip functions from data for the JSON view
  const getSerializableData = () => {
    return Object.keys(data).reduce((acc, key) => {
      if (typeof data[key] !== 'function') {
        acc[key] = data[key];
      }
      return acc;
    }, {} as any);
  };

  const [code, setCode] = useState(JSON.stringify(getSerializableData(), null, 2));

  // Sync when data changes from outside
  useEffect(() => {
    const newSerialized = JSON.stringify(getSerializableData(), null, 2);
    // basic check to avoid resetting code if there's an error state
    try {
      JSON.parse(code); 
      if (newSerialized !== code) {
         setCode(newSerialized);
      }
    } catch (e) {
      // currently editing invalid json, don't overwrite
    }
  }, [data]);

  const handleChange = (newCode: string, parsed: any, error: string | null) => {
    setCode(newCode);
    if (!error && parsed) {
      updateNodeData(nodeId, parsed);
    }
  };

  return <RawJsonEditor value={code} onChange={handleChange} />;
}
