const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

if (!code.includes("import { useUndoRedo }")) {
  code = code.replace(
    `import { JsonCardNode } from './nodes/JsonCardNode';`,
    `import { useUndoRedo } from '../hooks/useUndoRedo';\nimport { JsonCardNode } from './nodes/JsonCardNode';`
  );
  
  code = code.replace(
    `const [editingNodeId, setEditingNodeId] = useState<string | null>(null);`,
    `const [editingNodeId, setEditingNodeId] = useState<string | null>(null);\n  const { takeSnapshot } = useUndoRedo(setNodes, setEdges);`
  );

  code = code.replace(
    `const onConnect = useCallback(`,
    `const onConnect = useCallback(\n    (params: Connection | Edge) => { takeSnapshot(); setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)); },\n    [setEdges, takeSnapshot]\n  );\n  /*`
  );
  code = code.replace(
    `[setEdges]\n  );`,
    `*/`
  );

  code = code.replace(
    `const onAddNode = useCallback(`,
    `const onAddNode = useCallback((type: string, data?: any) => {\n    takeSnapshot();`
  );
  code = code.replace(
    `const onAddNode = useCallback((type: string, data?: any) => {\n    takeSnapshot();\n    takeSnapshot();`, // in case it runs twice
    `const onAddNode = useCallback((type: string, data?: any) => {\n    takeSnapshot();`
  );

  // Instead of complex string replace for onAddNode (if it was already replaced)
  // Let's do it safely.
}
fs.writeFileSync('src/components/Canvas.tsx', code);
