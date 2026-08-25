import { useReactFlow, NodeToolbar, Position } from '@xyflow/react';

const colors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  'transparent' // default
];

export function NodeColorPicker({ nodeId }: { nodeId: string }) {
  const { updateNodeData } = useReactFlow();

  return (
    <NodeToolbar position={Position.Top} className="flex gap-1 bg-card border border-border p-1.5 rounded-lg shadow-xl mb-2">
      {colors.map(color => (
        <button
          key={color}
          className="w-5 h-5 rounded-full border border-black/20 hover:scale-110 transition-transform"
          style={{ backgroundColor: color === 'transparent' ? '#27272a' : color }}
          onClick={() => updateNodeData(nodeId, { backgroundColor: color })}
          title={color === 'transparent' ? 'Reset Color' : color}
        />
      ))}
    </NodeToolbar>
  );
}
