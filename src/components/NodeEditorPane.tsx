import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { X, Code, LayoutTemplate } from 'lucide-react';
import { JsonEditor } from './nodes/JsonEditor';
import { NodeSettingsForm } from './NodeSettingsForm';

interface NodeEditorPaneProps {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeEditorPane({ nodeId, onClose }: NodeEditorPaneProps) {
  const { getNode } = useReactFlow();
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');

  const node = nodeId ? getNode(nodeId) : null;

  if (!nodeId || !node) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-canvas/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/30">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-main tracking-wide">
            Edit Node
          </h2>
          <span className="text-[10px] bg-surface px-2 py-0.5 rounded text-text-muted uppercase tracking-widest font-mono">
            {node.type}
          </span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-center p-3 border-b border-border bg-canvas/30">
        <div className="bg-surface rounded-lg p-1 flex items-center gap-1 border border-border/50">
          <button
            onClick={() => setViewMode('form')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
              viewMode === 'form' 
                ? 'bg-accent text-white shadow-sm' 
                : 'text-text-muted hover:text-text-main hover:bg-card'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Form
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
              viewMode === 'json' 
                ? 'bg-accent text-white shadow-sm' 
                : 'text-text-muted hover:text-text-main hover:bg-card'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {viewMode === 'form' ? (
          <NodeSettingsForm node={node} />
        ) : (
          <div className="h-full rounded-lg border border-border/50 overflow-hidden">
            <JsonEditor nodeId={node.id} data={node.data} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
