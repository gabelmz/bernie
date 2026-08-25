const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

code = code.replace(
  `const onAddNode = useCallback((type: string, data?: any) => {\n    takeSnapshot();(type: string, data: any = {}, position?: { x: number, y: number }) => {\n    const newNode = {`,
  `const onAddNode = useCallback((type: string, data: any = {}, position?: { x: number, y: number }) => {\n    takeSnapshot();\n    const newNode = {`
);

code = code.replace(
  `const deleteNode = useCallback(() => {\n    if (!menu) return;`,
  `const deleteNode = useCallback(() => {\n    if (!menu) return;\n    takeSnapshot();`
);

code = code.replace(
  `const deleteSelectedNodes = useCallback(() => {\n    if (!reactFlowInstance) return;`,
  `const deleteSelectedNodes = useCallback(() => {\n    if (!reactFlowInstance) return;\n    takeSnapshot();`
);

code = code.replace(
  `const duplicateNode = useCallback(() => {\n    if (!menu) return;`,
  `const duplicateNode = useCallback(() => {\n    if (!menu) return;\n    takeSnapshot();`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
