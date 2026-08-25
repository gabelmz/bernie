const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

code = code.replace(
  `onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}`,
  `onNodeDragStart={takeSnapshot}
          onSelectionDragStart={takeSnapshot}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}`
);

// We need to implement connection visually snapping.
// React flow already handles visual snapping when connectionRadius is high, but we can also set snapToGrid or add a connection line style.
code = code.replace(
  `connectionRadius={50}`,
  `connectionRadius={100}
          connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 3 }}`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
