const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(
  `--theme-text-muted: #a1a1aa; /* Zinc 400 */`,
  `--theme-text-muted: color-mix(in srgb, var(--theme-text) 60%, transparent);`
);

fs.writeFileSync('src/index.css', code);
