const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /bg-\[#000000\]/g, to: 'bg-canvas' },
  { from: /bg-black/g, to: 'bg-canvas' },
  { from: /bg-\[#0a0a0a\]/g, to: 'bg-card' },
  { from: /bg-\[#121212\]/g, to: 'bg-surface' },
  { from: /bg-\[#1f1f1f\]/g, to: 'bg-surface' },
  { from: /bg-\[#1a1a1a\]/g, to: 'bg-surface' },
  
  { from: /text-gray-100/g, to: 'text-text-main' },
  { from: /text-gray-200/g, to: 'text-text-main' },
  { from: /text-gray-300/g, to: 'text-text-main' },
  { from: /text-white/g, to: 'text-text-main' },
  
  { from: /text-gray-400/g, to: 'text-text-muted' },
  { from: /text-gray-500/g, to: 'text-text-muted' },
  
  { from: /border-\[#1a1a1a\]/g, to: 'border-border' },
  { from: /border-\[#262626\]/g, to: 'border-border' },
  { from: /border-\[#333\]/g, to: 'border-border' },
  
  { from: /bg-orange-600/g, to: 'bg-accent' },
  { from: /hover:bg-orange-500/g, to: 'hover:bg-accent-hover' },
  { from: /text-orange-500/g, to: 'text-accent' },
  { from: /focus:border-orange-500/g, to: 'focus:border-accent' },
  { from: /accent-orange-500/g, to: 'accent-accent' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Specifically handle Nav/Sidebar trans colors dynamically via style or classes
      // We will just do straight replace for now.
      
      for (const rule of replacements) {
        content = content.replace(rule.from, rule.to);
      }
      fs.writeFileSync(fullPath, content);
    }
  }
}

processDirectory('./src/components');
console.log('Done');
