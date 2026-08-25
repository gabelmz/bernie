const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');
code = code.replace(
  `<NavigationBar />`,
  `<NavigationBar onAddNode={onAddNode} />`
);
fs.writeFileSync('src/components/Canvas.tsx', code);

let navCode = fs.readFileSync('src/components/NavigationBar.tsx', 'utf8');
navCode = navCode.replace(
  `export function NavigationBar() {`,
  `export function NavigationBar({ onAddNode }: { onAddNode?: (type: string, data?: any) => void }) {`
);
navCode = navCode.replace(
  `<NodeGalleryPage onClose={() => setActivePage(null)} />`,
  `<NodeGalleryPage onClose={() => setActivePage(null)} onAddNode={onAddNode} />`
);
fs.writeFileSync('src/components/NavigationBar.tsx', navCode);
