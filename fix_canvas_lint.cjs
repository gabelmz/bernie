const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

code = code.replace(
  `const customName = prompt('Enter a name for this custom node template:', nodeToSave.data.title || 'Custom Node');`,
  `const customName = prompt('Enter a name for this custom node template:', (nodeToSave.data.title as string) || 'Custom Node');`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
