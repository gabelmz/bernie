import { useState } from 'react';
import { Book, Blocks, Puzzle, Settings, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { SettingsPage } from './SettingsPage';
import { IntegrationsPage } from './IntegrationsPage';
import { NodeGalleryPage } from './NodeGalleryPage';
import { DocsPage } from './DocsPage';

type Page = 'docs' | 'integrations' | 'database' | 'settings' | null;

export function NavigationBar({ onAddNode }: { onAddNode?: (type: string, data?: any) => void }) {
  const [collapsed, setCollapsed] = useState(true);
  const [activePage, setActivePage] = useState<Page>(null);

  const pages = [
    { id: 'docs', icon: Book, label: 'Docs' },
    { id: 'integrations', icon: Blocks, label: 'Integrations' },
    { id: 'database', icon: Puzzle, label: 'Node Gallery' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Floating Left Nav Bar */}
      <div 
        className={`absolute top-1/2 -translate-y-1/2 left-6 z-50 flex flex-col bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-2xl transition-all duration-300 ${collapsed ? 'w-14' : 'w-48'}`}
      >
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-surface border border-border rounded-full p-1 text-text-muted hover:text-text-main hover:bg-white/5 transition-colors z-10 shadow-md"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className="flex flex-col gap-2 p-2 overflow-hidden py-4">
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id as Page)}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors whitespace-nowrap ${
                activePage === page.id ? 'bg-surface text-text-main' : 'text-text-muted hover:bg-surface hover:text-text-main'
              }`}
              title={page.label}
            >
              <page.icon className="w-5 h-5 shrink-0" />
              <span className={`font-medium text-sm tracking-wide transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                {page.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Page Modal/Overlay */}
      {activePage === 'settings' ? (
        <SettingsPage onClose={() => setActivePage(null)} />
      ) : activePage ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-canvas/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-text-main tracking-wide capitalize">{activePage}</h2>
              <button 
                onClick={() => setActivePage(null)}
                className="p-2 hover:bg-surface rounded-full transition-colors text-text-muted hover:text-text-main"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {activePage === 'integrations' ? (
              <IntegrationsPage onClose={() => setActivePage(null)} />
            ) : activePage === 'database' ? (
              <NodeGalleryPage onClose={() => setActivePage(null)} onAddNode={onAddNode} />
            ) : activePage === 'docs' ? (
              <DocsPage onClose={() => setActivePage(null)} />
            ) : (
              <div className="p-8 text-text-muted text-sm overflow-y-auto">
                <div className="border border-dashed border-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
                  {(() => {
                     const PageIcon = pages.find(p => p.id === activePage)?.icon || Settings;
                     return <PageIcon className="w-12 h-12 text-gray-600" strokeWidth={1} />;
                  })()}
                  <p>This is the {activePage} page placeholder.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
