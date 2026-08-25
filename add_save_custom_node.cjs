const fs = require('fs');
let code = fs.readFileSync('src/components/Canvas.tsx', 'utf8');

if (!code.includes(`saveCustomNode`)) {
  code = code.replace(
    `const duplicateNode = useCallback(() => {`,
    `const saveCustomNode = useCallback(() => {
    if (!menu) return;
    const nodeToSave = nodes.find((n) => n.id === menu.id);
    if (nodeToSave) {
      const customName = prompt('Enter a name for this custom node template:', nodeToSave.data.title || 'Custom Node');
      if (customName) {
        const saved = localStorage.getItem('bernie-custom-nodes');
        let customNodes = saved ? JSON.parse(saved) : [];
        customNodes.push({
          id: Date.now().toString(),
          name: customName,
          type: nodeToSave.type,
          data: { ...nodeToSave.data, title: customName }
        });
        localStorage.setItem('bernie-custom-nodes', JSON.stringify(customNodes));
        alert('Custom node saved! You can find it in the Node Gallery.');
      }
    }
    closeMenu();
  }, [menu, nodes, closeMenu]);\n\n  const duplicateNode = useCallback(() => {`
  );

  code = code.replace(
    `<Copy className="w-4 h-4 text-text-muted" />
                    Duplicate Node
                  </button>`,
    `<Copy className="w-4 h-4 text-text-muted" />
                    Duplicate Node
                  </button>
                  <button 
                    onClick={saveCustomNode}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-text-muted" />
                    Save to Gallery
                  </button>`
  );

  fs.writeFileSync('src/components/Canvas.tsx', code);
}
