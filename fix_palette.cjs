const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

code = code.replace(
  `<CommandPalette />`,
  `<CommandPalette takeSnapshot={takeSnapshot} />`
);
fs.writeFileSync('src/components/Canvas.tsx', code);

let palette = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');
palette = palette.replace(
  `export function CommandPalette() {`,
  `export function CommandPalette({ takeSnapshot }: { takeSnapshot?: () => void }) {`
);

palette = palette.replace(
  `const clearCanvas = () => {`,
  `const clearCanvas = () => {
    if (takeSnapshot) takeSnapshot();`
);

palette = palette.replace(
  `const pasteJson = async () => {`,
  `const pasteJson = async () => {
    if (takeSnapshot) takeSnapshot();`
);

palette = palette.replace(
  `const importJson = () => {`,
  `const importJson = () => {
    if (takeSnapshot) takeSnapshot();`
);

fs.writeFileSync('src/components/CommandPalette.tsx', palette);
