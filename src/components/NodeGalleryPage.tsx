import React, { useState, useEffect } from 'react';
import { Play, Type, Code2, Terminal, Globe, Sparkles, Box, Trash2, MessageCircle, Video, Database, Plus, Puzzle, FileText, Blocks, Search } from 'lucide-react';

interface NodeGalleryPageProps {
  onClose: () => void;
  onAddNode?: (type: string, data?: any) => void;
}

const defaultNodes = [
  { type: 'trigger', title: 'Trigger', desc: 'Start the workflow', Icon: Play, color: 'text-green-500', bg: 'bg-green-500/10' },
  { type: 'text', title: 'Text Note', desc: 'Add instructions', Icon: Type, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { type: 'json', title: 'JSON Data', desc: 'Inject static payload', Icon: Code2, color: 'text-text-main', bg: 'bg-text-main/10' },
  { type: 'script', title: 'Script', desc: 'Run JavaScript logic', Icon: Terminal, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { type: 'http', title: 'HTTP Request', desc: 'Fetch external API', Icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { type: 'ai', title: 'AI Agent', desc: 'Execute LLM prompt', Icon: Sparkles, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { type: 'custom', title: 'Custom Tool', desc: 'Integration hook', Icon: Box, color: 'text-pink-400', bg: 'bg-pink-400/10' },
  { type: 'flush', title: 'Data Sink', desc: 'Terminates flow data', Icon: Trash2, color: 'text-red-400', bg: 'bg-red-400/10' },
  { type: 'sheet', title: 'Google Sheets', desc: 'Export data', Icon: Box, color: 'text-green-500', bg: 'bg-green-500/10' },
  { type: 'chat', title: 'Google Chat', desc: 'Send messages', Icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { type: 'meet', title: 'Google Meet', desc: 'Create meetings', Icon: Video, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { type: 'slack', title: 'Slack', desc: 'Send notifications', Icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { type: 'github', title: 'GitHub', desc: 'Manage repositories', Icon: Box, color: 'text-gray-500', bg: 'bg-gray-500/10' },
  { type: 'notion', title: 'Notion', desc: 'Create pages', Icon: FileText, color: 'text-stone-500', bg: 'bg-stone-500/10' },
  { type: 'stripe', title: 'Stripe', desc: 'Process payments', Icon: Box, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { type: 'database', title: 'Database', desc: 'SQL / NoSQL', Icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { type: 'template_ecommerce', title: 'E-commerce', desc: 'Workflow template', Icon: Blocks, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10' },
  { type: 'template_data_pipeline', title: 'Data Pipeline', desc: 'Workflow template', Icon: Blocks, color: 'text-violet-500', bg: 'bg-violet-500/10' },
];

export function NodeGalleryPage({ onClose, onAddNode }: NodeGalleryPageProps) {
  const [customNodes, setCustomNodes] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('bernie-custom-nodes');
    if (saved) {
      try {
        setCustomNodes(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleAdd = (type: string, data?: any) => {
    if (onAddNode) onAddNode(type, data);
    onClose();
  };

  const filteredDefault = defaultNodes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.desc.toLowerCase().includes(search.toLowerCase()));
  const filteredCustom = customNodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-surface/30">
        <div className="relative">
          <Search className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search nodes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-canvas border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main outline-none focus:border-accent"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {filteredCustom.length > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
              <Puzzle className="w-4 h-4" />
              Your Custom Nodes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredCustom.map(node => (
                <div key={node.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-accent hover:shadow-lg transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="bg-accent/10 p-2 rounded-lg text-accent">
                      <Puzzle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-semibold text-text-main truncate" title={node.name}>{node.name}</h4>
                      <p className="text-xs text-text-muted uppercase tracking-widest">{node.type}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAdd(node.type, node.data)}
                    className="w-full py-1.5 bg-canvas hover:bg-accent hover:text-white text-text-main border border-border rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add to Canvas
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center gap-2">
            <Blocks className="w-4 h-4" />
            Standard Library
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredDefault.map(node => (
              <div key={node.type} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-text-muted transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`${node.bg} p-2 rounded-lg ${node.color}`}>
                    <node.Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-semibold text-text-main truncate" title={node.title}>{node.title}</h4>
                    <p className="text-xs text-text-muted truncate" title={node.desc}>{node.desc}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleAdd(node.type, { title: node.title })}
                  className="w-full py-1.5 bg-canvas hover:bg-accent hover:text-white text-text-main border border-border rounded-lg text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Canvas
                </button>
              </div>
            ))}
            {filteredDefault.length === 0 && (
              <div className="col-span-full py-8 text-center text-text-muted text-sm">
                No standard nodes found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
