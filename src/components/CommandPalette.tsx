import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, X, Command, Download, Upload, Copy, ClipboardPaste, Camera, MessageSquare, Github, Book, CreditCard, Cloud, Database, Calculator, Filter, Hourglass, Timer, Mail, Smartphone, Webhook, Languages, Map, MessageCircle, ShoppingCart, Network, UserPlus, FileText } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { toPng } from 'html-to-image';

export function CommandPalette({ takeSnapshot }: { takeSnapshot?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes, setEdges, getViewport, screenToFlowPosition, getNodes, getEdges, setViewport } = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addNode = (type: string, title: string) => {
    const centerPoint = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setNodes((nds) => [
      ...nds,
      {
        id: nanoid(),
        type,
        position: { x: centerPoint.x - 100, y: centerPoint.y - 50 },
        data: { title },
      }
    ]);
    setIsOpen(false);
  };

  const clearCanvas = () => {
    if (takeSnapshot) takeSnapshot();
    setNodes([]);
    setEdges([]);
    setIsOpen(false);
  };

  const downloadJson = () => {
    const flow = { nodes: getNodes(), edges: getEdges(), viewport: getViewport() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flow, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'canvas-export.json';
    a.click();
    setIsOpen(false);
  };

  const importJson = () => {
    if (takeSnapshot) takeSnapshot();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const flow = JSON.parse(e.target?.result as string);
            if (flow.nodes) setNodes(flow.nodes);
            if (flow.edges) setEdges(flow.edges);
            if (flow.viewport) setViewport(flow.viewport);
          } catch (err) {
            alert('Failed to parse JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
    setIsOpen(false);
  };

  const copyJson = () => {
    const flow = { nodes: getNodes(), edges: getEdges(), viewport: getViewport() };
    navigator.clipboard.writeText(JSON.stringify(flow, null, 2));
    setIsOpen(false);
  };

  const pasteJson = async () => {
    if (takeSnapshot) takeSnapshot();
    try {
      const text = await navigator.clipboard.readText();
      const flow = JSON.parse(text);
      if (flow.nodes) setNodes(flow.nodes);
      if (flow.edges) setEdges(flow.edges);
      if (flow.viewport) setViewport(flow.viewport);
    } catch (err) {
      alert('Clipboard does not contain a valid Canvas JSON object.');
    }
    setIsOpen(false);
  };

  const downloadImage = () => {
    const el = document.querySelector('.react-flow') as HTMLElement;
    if (el) {
      toPng(el, { filter: (node) => !node.classList?.contains('react-flow__minimap') && !node.classList?.contains('react-flow__controls') })
        .then((dataUrl) => {
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = 'canvas-snapshot.png';
          a.click();
        });
    }
    setIsOpen(false);
  };

  const toggleHandles = () => {
    const isShowing = document.body.classList.toggle('show-vertical-handles');
    localStorage.setItem('bernie-show-handles', isShowing ? 'true' : 'false');
    setIsOpen(false);
  };

  useEffect(() => {
    if (localStorage.getItem('bernie-show-handles') === 'true') {
      document.body.classList.add('show-vertical-handles');
    }
  }, []);

  const commands = [
    { name: 'Add Trigger Node', action: () => addNode('trigger', 'Trigger'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add HTTP Node', action: () => addNode('http', 'HTTP Request'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add AI Node', action: () => addNode('ai', 'AI Agent'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Script Node', action: () => addNode('script', 'Script'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add JSON Node', action: () => addNode('json', 'JSON Data'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Google Drive Node', action: () => addNode('drive', 'Google Drive'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Google Sheets Node', action: () => addNode('sheet', 'Google Sheets'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Chat Node', action: () => addNode('chat', 'Google Chat'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Meet Node', action: () => addNode('meet', 'Google Meet'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Sink Node', action: () => addNode('flush', 'Data Sink'), icon: <Plus className="w-4 h-4" /> },
    { name: 'Add Slack Node', action: () => addNode('slack', 'Slack'), icon: <MessageSquare className="w-4 h-4" /> },
    { name: 'Add GitHub Node', action: () => addNode('github', 'GitHub'), icon: <Github className="w-4 h-4" /> },
    { name: 'Add Notion Node', action: () => addNode('notion', 'Notion'), icon: <Book className="w-4 h-4" /> },
    { name: 'Add Stripe Node', action: () => addNode('stripe', 'Stripe'), icon: <CreditCard className="w-4 h-4" /> },
    { name: 'Add Weather Node', action: () => addNode('weather', 'Weather'), icon: <Cloud className="w-4 h-4" /> },
    { name: 'Add Database Node', action: () => addNode('database', 'Database'), icon: <Database className="w-4 h-4" /> },
    { name: 'Add Math Ops Node', action: () => addNode('math', 'Math Ops'), icon: <Calculator className="w-4 h-4" /> },
    { name: 'Add Filter Node', action: () => addNode('filter', 'Filter'), icon: <Filter className="w-4 h-4" /> },
    { name: 'Add Delay Node', action: () => addNode('delay', 'Delay'), icon: <Hourglass className="w-4 h-4" /> },
    { name: 'Add Timer Node', action: () => addNode('timer', 'Timer'), icon: <Timer className="w-4 h-4" /> },
    { name: 'Add Send Email Node', action: () => addNode('email', 'Send Email'), icon: <Mail className="w-4 h-4" /> },
    { name: 'Add Send SMS Node', action: () => addNode('sms', 'Send SMS'), icon: <Smartphone className="w-4 h-4" /> },
    { name: 'Add Webhook Node', action: () => addNode('webhook', 'Webhook'), icon: <Webhook className="w-4 h-4" /> },
    { name: 'Add Translate Node', action: () => addNode('translate', 'Translate'), icon: <Languages className="w-4 h-4" /> },
    { name: 'Add Map Node', action: () => addNode('map', 'Map'), icon: <Map className="w-4 h-4" /> },
    { name: 'Add Discord Node', action: () => addNode('discord', 'Discord'), icon: <MessageCircle className="w-4 h-4" /> },
    { name: 'Add E-commerce Node', action: () => addNode('template_ecommerce', 'E-commerce'), icon: <ShoppingCart className="w-4 h-4" /> },
    { name: 'Add Data Pipeline Node', action: () => addNode('template_data_pipeline', 'Data Pipeline'), icon: <Network className="w-4 h-4" /> },
    { name: 'Add Onboarding Node', action: () => addNode('template_onboarding', 'Onboarding'), icon: <UserPlus className="w-4 h-4" /> },
    { name: 'Add Daily Report Node', action: () => addNode('template_report', 'Daily Report'), icon: <FileText className="w-4 h-4" /> },
    { name: 'Export Canvas to JSON', action: downloadJson, icon: <Download className="w-4 h-4" /> },
    { name: 'Import Canvas from JSON', action: importJson, icon: <Upload className="w-4 h-4" /> },
    { name: 'Copy Canvas JSON to Clipboard', action: copyJson, icon: <Copy className="w-4 h-4" /> },
    { name: 'Paste Canvas JSON from Clipboard', action: pasteJson, icon: <ClipboardPaste className="w-4 h-4" /> },
    { name: 'Download Canvas Snapshot (PNG)', action: downloadImage, icon: <Camera className="w-4 h-4" /> },
    { name: 'Toggle Top/Bottom Node Handles', action: toggleHandles, icon: <Command className="w-4 h-4" /> },
    { name: 'Clear Canvas', action: clearCanvas, danger: true, icon: <Trash2 className="w-4 h-4" /> },
  ];

  const filtered = commands.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="absolute inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-canvas/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/30">
          <Command className="w-5 h-5 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-text-main text-base placeholder-text-muted/60"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-main">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 flex flex-col gap-1">
          {filtered.length > 0 ? filtered.map((cmd, idx) => (
            <button
              key={idx}
              onClick={cmd.action}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                cmd.danger 
                  ? 'text-red-400 hover:bg-red-500/10' 
                  : 'text-text-main hover:bg-accent/20 hover:text-accent-hover'
              }`}
            >
              {cmd.icon}
              {cmd.name}
            </button>
          )) : (
            <div className="text-center py-8 text-text-muted text-sm">
              No commands found for "{search}"
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border bg-surface/50 text-[10px] text-text-muted flex justify-between uppercase tracking-widest">
          <span>Navigation</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  );
}
