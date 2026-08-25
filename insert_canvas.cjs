const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

const imports = fs.readFileSync('generated_canvas_additions.txt', 'utf8').split('\n\n')[0];
const types = fs.readFileSync('generated_canvas_additions.txt', 'utf8').split('\n\n')[1];

code = code.replace(
  `import { MeetNode } from './nodes/MeetNode';`,
  `import { MeetNode } from './nodes/MeetNode';\n${imports}`
);

code = code.replace(
  `meet: MeetNode,`,
  `meet: MeetNode,\n${types}`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
