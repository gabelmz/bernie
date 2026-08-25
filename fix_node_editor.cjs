const fs = require('fs');
let code = fs.readFileSync('src/components/NodeEditorPane.tsx', 'utf8');

code = code.replace(
  `className="absolute inset-y-0 right-0 w-[400px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-full duration-200"`,
  `className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"`
);

code = code.replace(
  `return (
    <div className`,
  `return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-canvas/60 backdrop-blur-sm p-4">
      <div className`
);

// Close the wrapper
code = code.replace(
  `</div>
    </div>
  );`,
  `</div>
      </div>
    </div>
  );`
);

fs.writeFileSync('src/components/NodeEditorPane.tsx', code);
