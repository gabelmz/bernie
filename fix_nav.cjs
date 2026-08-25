const fs = require('fs');
let code = fs.readFileSync('src/components/NavigationBar.tsx', 'utf8');

code = code.replace(
  `import { Book, Blocks, Database, Settings, ChevronRight, ChevronLeft, X } from 'lucide-react';`,
  `import { Book, Blocks, Puzzle, Settings, ChevronRight, ChevronLeft, X } from 'lucide-react';`
);

code = code.replace(
  `{ id: 'database', icon: Database, label: 'Database' },`,
  `{ id: 'database', icon: Puzzle, label: 'Node Gallery' },`
);

if (!code.includes(`import { NodeGalleryPage }`)) {
  code = code.replace(
    `import { IntegrationsPage } from './IntegrationsPage';`,
    `import { IntegrationsPage } from './IntegrationsPage';\nimport { NodeGalleryPage } from './NodeGalleryPage';\nimport { DocsPage } from './DocsPage';`
  );
}

code = code.replace(
  `{activePage === 'integrations' ? (
              <IntegrationsPage onClose={() => setActivePage(null)} />
            ) : (`,
  `{activePage === 'integrations' ? (
              <IntegrationsPage onClose={() => setActivePage(null)} />
            ) : activePage === 'database' ? (
              <NodeGalleryPage onClose={() => setActivePage(null)} />
            ) : activePage === 'docs' ? (
              <DocsPage onClose={() => setActivePage(null)} />
            ) : (`
);

fs.writeFileSync('src/components/NavigationBar.tsx', code);
