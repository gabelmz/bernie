const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

// 1. Remove duplicate connectionRadius
code = code.replace(
  `snapToGrid={snapToGrid}
          connectionRadius={50}
          snapGrid={[snapGridSize, snapGridSize]}
          connectionRadius={40}`,
  `snapToGrid={snapToGrid}
          snapGrid={[snapGridSize, snapGridSize]}
          connectionRadius={50}`
);

// 2. Add missing imports
code = code.replace(
  `import { Hexagon, Grid, SlidersHorizontal, Settings2, X, Copy, Trash2, Eye, Play, List, Map, Wand2, Hand, MousePointer2, Group, Magnet } from 'lucide-react';`,
  `import { Hexagon, Grid, SlidersHorizontal, Settings2, X, Copy, Trash2, Eye, Play, List, Map, Wand2, Hand, MousePointer2, Group, Magnet, Globe, Sparkles } from 'lucide-react';`
);

fs.writeFileSync('src/components/Canvas.tsx', code);
