import { X, Save, Palette, Layout, Type, Maximize } from 'lucide-react';
import { useTheme, themePresets } from '../contexts/ThemeContext';

interface SettingsPageProps {
  onClose: () => void;
}


import { useState } from 'react';
import { Network, User, Plug, Database, Key } from 'lucide-react';
export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState('appearance');
  const { theme, setTheme } = useTheme();

  const handleChange = (key: string, value: string, subKey?: string) => {
    if (subKey) {
      setTheme(prev => ({
        ...prev,
        [key]: {
          ...(prev as any)[key],
          [subKey]: value
        }
      }));
    } else {
      setTheme(prev => ({ ...prev, [key]: value }));
    }
  };

  return (
    <div className="absolute inset-0 z-[60] bg-canvas flex flex-col font-sans text-text-main">
      <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
        <div>
          <h2 className="text-2xl font-bold text-text-main tracking-wide">Settings</h2>
          <p className="text-sm text-text-muted mt-1">Manage your application preferences and connections.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-text-main px-5 py-2.5 rounded-lg font-semibold tracking-wide transition-colors">
            <Save className="w-4 h-4" />
            Save Changes
          </button>
          <button 
            onClick={onClose}
            className="p-2.5 hover:bg-surface rounded-full transition-colors text-text-muted hover:text-text-main border border-border"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-border bg-card p-4 flex flex-col gap-2 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'appearance' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <Palette className="w-5 h-5" />
            Appearance
          </button>
          <button 
            onClick={() => setActiveTab('connections')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'connections' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <Network className="w-5 h-5" />
            Connections
          </button>
          <button 
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${activeTab === 'account' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <User className="w-5 h-5" />
            Account & Guest
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 relative">
          {activeTab === 'appearance' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">


            </div>
          )}
          {activeTab === 'connections' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-text-main mb-6 uppercase tracking-widest border-b border-border pb-4 flex items-center gap-3">
                  <Network className="w-5 h-5 text-accent" />
                  Connections Workshop
                </h3>
                <div className="space-y-6">
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Plug className="w-4 h-4 text-emerald-400" /> Model Context Protocol (MCP)
                    </h4>
                    <p className="text-sm text-text-muted mb-4">Connect to local MCP servers to expand your node gallery dynamically with custom tooling.</p>
                    <div className="flex items-center gap-4">
                      <input type="text" placeholder="ws://localhost:3001" className="flex-1 bg-canvas border border-border rounded-lg p-2.5 text-sm outline-none focus:border-accent" />
                      <button className="bg-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90">Connect MCP</button>
                    </div>
                  </div>
                  
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-400" /> Database Integrations
                    </h4>
                    <p className="text-sm text-text-muted mb-4">Configure default connection strings for Database nodes across your canvas.</p>
                    <input type="password" placeholder="postgresql://..." className="w-full bg-canvas border border-border rounded-lg p-2.5 text-sm outline-none focus:border-accent" />
                  </div>

                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-yellow-400" /> AI Provider API Keys
                    </h4>
                    <p className="text-sm text-text-muted mb-4">Provide keys for standard AI nodes (OpenAI, Anthropic, Gemini, etc).</p>
                    <div className="space-y-3">
                       <input type="password" placeholder="OpenAI API Key" className="w-full bg-canvas border border-border rounded-lg p-2.5 text-sm outline-none focus:border-accent" />
                       <input type="password" placeholder="Anthropic API Key" className="w-full bg-canvas border border-border rounded-lg p-2.5 text-sm outline-none focus:border-accent" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'account' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-text-main mb-6 uppercase tracking-widest border-b border-border pb-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-accent" />
                  Account & Authentication
                </h3>
                
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-text-main">Guest User Support</h4>
                      <p className="text-sm text-text-muted">Allow anonymous execution without requiring an account. (Local storage persistence)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-canvas border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                  
                  <hr className="border-border" />
                  
                  <div className="flex flex-col gap-2">
                     <p className="text-sm text-text-muted">You are currently operating in <strong>Guest Mode</strong>. Your data is stored locally in your browser. To sync across devices, please log in.</p>
                     <button className="bg-canvas border border-border text-text-main hover:bg-surface px-4 py-2 rounded-lg text-sm font-semibold transition-colors self-start">Sign In / Register</button>
                  </div>
                </div>

                <div className="mt-8 bg-surface border border-border rounded-xl p-5 space-y-4">
                  <h4 className="font-semibold text-text-main">Build Environments</h4>
                  <p className="text-sm text-text-muted">Prepare application for specific deployment targets.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="bg-canvas border border-border text-text-main hover:bg-surface p-4 rounded-lg flex flex-col items-center gap-2">
                      <span className="font-semibold text-sm">Web Application</span>
                      <span className="text-xs text-text-muted">Standard React Build</span>
                    </button>
                    <button className="bg-canvas border border-accent text-accent hover:bg-surface p-4 rounded-lg flex flex-col items-center gap-2">
                      <span className="font-semibold text-sm">Electron Desktop</span>
                      <span className="text-xs text-accent">Ready for Local IPC</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
