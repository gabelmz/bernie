const fs = require('fs');
let code = fs.readFileSync('src/components/NodeSettingsForm.tsx', 'utf8');

const additions = fs.readFileSync('generated_settings_additions.txt', 'utf8');

code = code.replace(
  `case 'trigger':`,
  `${additions}\n    case 'trigger':`
);

fs.writeFileSync('src/components/NodeSettingsForm.tsx', code);
