const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

if (!code.includes("base: './'")) {
  code = code.replace(
    `return {`,
    `return {\n    base: './',`
  );
  fs.writeFileSync('vite.config.ts', code);
}
