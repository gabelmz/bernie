import React, { useState, useEffect } from 'react';
import { initAuth } from '../lib/firebase';
import { Database, Code2, Globe, Sparkles, FileText, Type, Terminal, Box, Trash2, Play , PanelRightClose, PanelRightOpen, ChevronRight, ChevronLeft, MessageCircle, Video } from 'lucide-react';
import { User } from 'firebase/auth';

interface SidebarProps {
  onAddNode?: (type: string, data?: any) => void;
}

export function Sidebar({ onAddNode }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Layout mode state
  const [viewMode, setViewMode] = useState<'panel' | 'floating'>('panel');
  const [floatingExpanded, setFloatingExpanded] = useState(true);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        fetchRecentDriveFiles(t);
      },
      () => {
        setUser(null);
        setToken(null);
        setDriveFiles([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchRecentDriveFiles = async (accessToken: string) => {
    setLoadingFiles(true);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&orderBy=modifiedByMeTime desc', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.files) {
        setDriveFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch drive files", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeData: any) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, data: nodeData }));
    event.dataTransfer.effectAllowed = 'move';
  };

  const nodeOptions = [
    { type: 'trigger', title: 'Trigger', desc: 'Start the workflow', data: { title: 'Workflow Trigger' }, Icon: Play, iconColor: 'text-green-500', bgClass: 'bg-green-500/10' },
    { type: 'text', title: 'Text Note', desc: 'Add instructions', data: { title: 'Text Note', text: '' }, Icon: Type, iconColor: 'text-blue-400', bgClass: 'bg-blue-400/10' },
    { type: 'json', title: 'JSON Data', desc: 'Inject static payload', data: { title: 'Static Data', jsonData: { sample: "value" } }, Icon: Code2, iconColor: 'text-text-main', bgClass: 'bg-text-main/10' },
    { type: 'script', title: 'Script', desc: 'Run JavaScript logic', data: { title: 'Custom Script', script: 'return input;' }, Icon: Terminal, iconColor: 'text-yellow-400', bgClass: 'bg-yellow-400/10' },
    { type: 'http', title: 'HTTP Request', desc: 'Fetch external API', data: { title: 'External API', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' }, Icon: Globe, iconColor: 'text-emerald-400', bgClass: 'bg-emerald-400/10' },
    { type: 'ai', title: 'AI Agent', desc: 'Execute LLM prompt', data: { title: 'AI Logic', prompt: 'Analyze this data and identify automation opportunities.' }, Icon: Sparkles, iconColor: 'text-purple-400', bgClass: 'bg-purple-400/10' },
    { type: 'custom', title: 'Custom Tool', desc: 'Integration hook', data: { title: 'Custom Tool' }, Icon: Box, iconColor: 'text-pink-400', bgClass: 'bg-pink-400/10' },
    { type: 'flush', title: 'Data Sink', desc: 'Terminates flow data', data: { title: 'Data Sink' }, Icon: Trash2, iconColor: 'text-red-400', bgClass: 'bg-red-400/10' },
    { type: 'sheet', title: 'Google Sheets', desc: 'Export data', data: { title: 'Google Sheets', sheetName: 'Sheet1' }, Icon: Box, iconColor: 'text-green-500', bgClass: 'bg-green-500/10' },
    { type: 'chat', title: 'Google Chat', desc: 'Send messages', data: { title: 'Google Chat' }, Icon: MessageCircle, iconColor: 'text-emerald-500', bgClass: 'bg-emerald-500/10' },
    { type: 'meet', title: 'Google Meet', desc: 'Create meetings', data: { title: 'Google Meet' }, Icon: Video, iconColor: 'text-blue-500', bgClass: 'bg-blue-500/10' },
  ];

  if (viewMode === 'floating') {
    return (
      <div 
        className={`absolute right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-2xl transition-all duration-300 ${floatingExpanded ? 'w-48' : 'w-14'}`}
      >
        {/* Toggle Mode / Expand Button */}
        <div className="flex flex-col items-center gap-2 p-2 border-b border-border bg-surface/50 rounded-t-2xl">
          <div className="flex items-center justify-between w-full">
            {floatingExpanded && <span className="font-semibold text-xs tracking-wide text-text-main px-2">Palette</span>}
            <button 
              onClick={() => setViewMode('panel')}
              className="p-1 text-text-muted hover:text-text-main hover:bg-white/5 rounded-md transition-colors"
              title="Dock to side panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setFloatingExpanded(!floatingExpanded)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 bg-surface border border-border rounded-full p-1 text-text-muted hover:text-text-main hover:bg-white/5 transition-colors z-10 shadow-md"
          >
            {floatingExpanded ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </div>

        <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[70vh]">
          {nodeOptions.map(opt => (
            <div 
              key={opt.type}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-grab hover:bg-surface border border-transparent hover:border-border transition-all active:cursor-grabbing ${floatingExpanded ? '' : 'justify-center'}`}
              draggable
              onDragStart={(e) => onDragStart(e, opt.type, opt.data)}
              title={opt.title}
            >
              <div className={`${opt.bgClass} p-2 rounded-lg shrink-0`}>
                <opt.Icon className={`w-4 h-4 ${opt.iconColor}`} />
              </div>
              {floatingExpanded && (
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-text-main truncate">{opt.title}</h3>
                </div>
              )}
            </div>
          ))}
          
          <div className="h-px bg-border my-1 mx-2" />
          
          {/* Drive specific floating entry */}
          <div 
            className={`flex flex-col p-2 bg-surface/50 border border-border rounded-xl cursor-grab hover:bg-surface hover:border-text-muted transition-all active:cursor-grabbing ${floatingExpanded ? '' : 'items-center'}`}
            draggable
            onDragStart={(e) => onDragStart(e, 'drive', { title: 'Drive Connector' })}
            title="Google Drive"
          >
            <div className={`flex items-center gap-3 ${floatingExpanded ? '' : 'justify-center'}`}>
              <div className="bg-orange-400/10 p-2 rounded-lg shrink-0">
                <Database className="w-4 h-4 text-orange-400" />
              </div>
              {floatingExpanded && (
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-xs font-semibold text-text-main truncate">Google Drive</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default Panel View
  return (
    <div className="w-72 shrink-0 h-full bg-card border-l border-border shadow-2xl z-50 flex flex-col relative transition-all duration-300">
      <div className="p-5 border-b border-border bg-surface/50 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold text-text-main tracking-wide">Node Palette</h2>
          <p className="text-sm text-text-muted mt-1 leading-relaxed">Drag nodes onto the canvas to build your workflow.</p>
        </div>
        <button 
          onClick={() => setViewMode('floating')}
          className="p-1.5 text-text-muted hover:text-text-main hover:bg-white/5 rounded-md transition-colors shadow-sm bg-surface border border-border"
          title="Float panel"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {nodeOptions.map(opt => (
          <div 
            key={opt.type}
            className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl cursor-grab hover:border-text-muted hover:shadow-lg transition-all active:cursor-grabbing"
            draggable
            onDragStart={(e) => onDragStart(e, opt.type, opt.data)}
          >
            <div className={`${opt.bgClass} p-2 rounded-lg`}>
              <opt.Icon className={`w-5 h-5 ${opt.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-main">{opt.title}</h3>
              <p className="text-xs text-text-muted mt-0.5">{opt.desc}</p>
            </div>
          </div>
        ))}

        {/* Drive section - combined header + recent files */}
        <div className="flex flex-col p-3 bg-surface border border-border rounded-xl">
          <div 
            className="flex items-center gap-3 cursor-grab hover:opacity-80 transition-opacity active:cursor-grabbing"
            draggable
            onDragStart={(e) => onDragStart(e, 'drive', { title: 'Drive Connector' })}
          >
            <div className="bg-orange-400/10 p-2 rounded-lg">
              <Database className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-main">Google Drive</h3>
              <p className="text-xs text-text-muted mt-0.5">Read/Write files</p>
            </div>
          </div>
          
          {user && driveFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
              <p className="text-[10px] uppercase text-text-muted font-bold tracking-wider mb-1">Recent Files (Drag to add)</p>
              {driveFiles.slice(0, 5).map(file => (
                <div 
                  key={file.id}
                  className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-border transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, 'drive', { title: 'Drive Integration', fileId: file.id, fileName: file.name })}
                >
                  <FileText className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-xs text-text-main truncate" title={file.name}>{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

