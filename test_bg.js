const fs = require('fs');
const file = './src/components/Canvas.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(/bg-black/g, 'bg-canvas');
fs.writeFileSync(file, c);
