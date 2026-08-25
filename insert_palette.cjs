const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

const additions = fs.readFileSync('generated_palette_additions.txt', 'utf8');

code = code.replace(
  `{ name: 'Add Sink Node', action: () => addNode('flush', 'Data Sink'), icon: <Plus className="w-4 h-4" /> },`,
  `{ name: 'Add Sink Node', action: () => addNode('flush', 'Data Sink'), icon: <Plus className="w-4 h-4" /> },\n${additions}`
);

// We also need to add all those lucide-react icons...
const icons = [
  'MessageSquare', 'Github', 'Book', 'CreditCard', 'Cloud', 'Database', 'Calculator',
  'Filter', 'Hourglass', 'Timer', 'Mail', 'Smartphone', 'Webhook', 'Languages', 'Map',
  'MessageCircle', 'ShoppingCart', 'Network', 'UserPlus', 'FileText'
];

code = code.replace(
  `import { Search, Plus, Trash2, X, Command, Download, Upload, Copy, ClipboardPaste, Camera } from 'lucide-react';`,
  `import { Search, Plus, Trash2, X, Command, Download, Upload, Copy, ClipboardPaste, Camera, ${icons.join(', ')} } from 'lucide-react';`
);

fs.writeFileSync('src/components/CommandPalette.tsx', code);
