const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(
  `--theme-border-subtle: #1f1f22;`,
  `--theme-border-subtle: color-mix(in srgb, var(--theme-border) 50%, transparent);`
);

fs.writeFileSync('src/index.css', code);
