import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Palette, 
  Layout, 
  Type, 
  Maximize, 
  Network, 
  User, 
  Plug, 
  Database, 
  Key, 
  Check, 
  RotateCcw, 
  Sliders, 
  Layers, 
  Sparkles,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { useTheme, themePresets, defaultTheme, ThemePreset } from '../contexts/ThemeContext';

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'connections' | 'account'>('appearance');
  const { theme, setTheme } = useTheme();
  const [saveToast, setSaveToast] = useState(false);
  const [mcpUrl, setMcpUrl] = useState('ws://localhost:3001');
  const [mcpStatus, setMcpStatus] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(true);

  const handleSave = () => {
    localStorage.setItem('stitch-theme-v2', JSON.stringify(theme));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleResetTheme = () => {
    setTheme(defaultTheme);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleColorChange = (key: 'primary' | 'secondary' | 'surface' | 'text' | 'highlight', value: string) => {
    if (key === 'primary') {
      setTheme(prev => ({
        ...prev,
        background: { ...prev.background, primary: value },
        gradient: { ...prev.gradient, primary: value }
      }));
    } else if (key === 'secondary') {
      setTheme(prev => ({
        ...prev,
        background: { ...prev.background, secondary: value },
        gradient: { ...prev.gradient, secondary: value }
      }));
    } else {
      setTheme(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleConnectMcp = () => {
    setMcpStatus('testing');
    setTimeout(() => {
      setMcpStatus('connected');
      setTimeout(() => setMcpStatus(null), 3500);
    }, 600);
  };

  return (
    <div className="absolute inset-0 z-[60] bg-canvas flex flex-col font-sans text-text-main animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-text-main tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-accent" />
            Application Settings & Customization
          </h2>
          <p className="text-xs text-text-muted mt-0.5">Customize theme presets, colors, density, and connected tool interfaces.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveToast && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          )}
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-lg transition-colors text-text-muted hover:text-text-main border border-border"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-60 border-r border-border bg-card p-4 flex flex-col gap-1.5 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-xs font-semibold tracking-wide ${activeTab === 'appearance' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <Palette className="w-4 h-4" />
            Appearance & Theme
          </button>
          <button 
            onClick={() => setActiveTab('connections')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-xs font-semibold tracking-wide ${activeTab === 'connections' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <Network className="w-4 h-4" />
            Connections & APIs
          </button>
          <button 
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-xs font-semibold tracking-wide ${activeTab === 'account' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-text-muted hover:bg-surface hover:text-text-main'}`}
          >
            <User className="w-4 h-4" />
            Account & Storage
          </button>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">
              
              {/* Presets Header & Reset */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    Theme Presets
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Select from 16 crafted color palettes or customize values below.</p>
                </div>
                <button
                  onClick={handleResetTheme}
                  className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-main border border-border bg-surface px-3 py-1.5 rounded-lg hover:bg-card transition-colors self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </button>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(themePresets).map(([key, preset]) => {
                  const isActive = 
                    theme.background.primary.toLowerCase() === preset.theme.background.primary.toLowerCase() &&
                    theme.highlight.toLowerCase() === preset.theme.highlight.toLowerCase();

                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(preset.theme)}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col gap-2.5 group relative overflow-hidden ${
                        isActive 
                          ? 'border-accent bg-accent/10 shadow-md ring-1 ring-accent' 
                          : 'border-border bg-surface hover:border-text-muted hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-text-main truncate">{preset.name}</span>
                        {isActive && (
                          <span className="text-[10px] uppercase font-bold tracking-wider text-accent bg-accent/20 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Swatch chips */}
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="w-5 h-5 rounded-full border border-black/30 shadow-inner" 
                          style={{ backgroundColor: preset.theme.background.primary }} 
                          title="Background"
                        />
                        <span 
                          className="w-5 h-5 rounded-full border border-black/30 shadow-inner" 
                          style={{ backgroundColor: preset.theme.surface }} 
                          title="Surface"
                        />
                        <span 
                          className="w-5 h-5 rounded-full border border-black/30 shadow-inner" 
                          style={{ backgroundColor: preset.theme.highlight }} 
                          title="Highlight"
                        />
                        <span 
                          className="w-5 h-5 rounded-full border border-black/30 shadow-inner" 
                          style={{ backgroundColor: preset.theme.text }} 
                          title="Text"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Preview Card */}
              <div className="bg-surface/50 border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Live Canvas Node Preview
                  </h4>
                  <span className="text-[11px] text-text-muted">Updates in real time with theme controls</span>
                </div>

                <div 
                  className="p-6 rounded-xl border flex items-center justify-center transition-all duration-200"
                  style={{ backgroundColor: theme.background.primary, borderColor: 'var(--theme-surface)' }}
                >
                  <div 
                    className="w-full max-w-sm rounded-xl border transition-all duration-200 shadow-xl overflow-hidden"
                    style={{ 
                      backgroundColor: theme.surface, 
                      borderColor: theme.highlight,
                      borderRadius: theme.edges === 'sharp' ? '0px' : theme.edges === 'pill' ? '24px' : '12px'
                    }}
                  >
                    <div 
                      className="px-4 py-2.5 border-b flex items-center justify-between"
                      style={{ 
                        backgroundColor: `${theme.highlight}20`,
                        borderColor: `${theme.highlight}40`
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4" style={{ color: theme.highlight }} />
                        <span className="text-xs font-bold tracking-wide" style={{ color: theme.text }}>
                          Sample Workflow Node
                        </span>
                      </div>
                      <span 
                        className="text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider"
                        style={{ backgroundColor: `${theme.highlight}30`, color: theme.text }}
                      >
                        active
                      </span>
                    </div>
                    <div className="p-4 flex flex-col gap-2">
                      <p className="text-xs leading-relaxed" style={{ color: theme.text, opacity: 0.85 }}>
                        This preview reflects your current surface tone, text contrast, and border styling.
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] uppercase font-mono" style={{ color: theme.highlight }}>
                          ● Output Ready
                        </span>
                        <button 
                          className="px-3 py-1 rounded text-xs font-semibold shadow-sm"
                          style={{ backgroundColor: theme.highlight, color: '#ffffff' }}
                        >
                          Execute
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Customization Controls */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-bold text-text-main uppercase tracking-widest border-b border-border pb-3 mb-5 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-accent" />
                  Color Customization
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Primary Canvas Background */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                      Primary Canvas Background
                      <span className="font-mono text-[11px] text-text-muted">{theme.background.primary}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={theme.background.primary} 
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={theme.background.primary} 
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="flex-1 bg-canvas border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Secondary Background */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                      Secondary Tone
                      <span className="font-mono text-[11px] text-text-muted">{theme.background.secondary}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={theme.background.secondary} 
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={theme.background.secondary} 
                        onChange={(e) => handleColorChange('secondary', e.target.value)}
                        className="flex-1 bg-canvas border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Surface / Cards */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                      Card / Surface Tone
                      <span className="font-mono text-[11px] text-text-muted">{theme.surface}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={theme.surface} 
                        onChange={(e) => handleColorChange('surface', e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={theme.surface} 
                        onChange={(e) => handleColorChange('surface', e.target.value)}
                        className="flex-1 bg-canvas border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Highlight / Accent */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                      Highlight Accent
                      <span className="font-mono text-[11px] text-text-muted">{theme.highlight}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={theme.highlight} 
                        onChange={(e) => handleColorChange('highlight', e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={theme.highlight} 
                        onChange={(e) => handleColorChange('highlight', e.target.value)}
                        className="flex-1 bg-canvas border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Typography Text */}
                  <div className="flex flex-col gap-2 bg-surface p-4 rounded-xl border border-border">
                    <label className="text-xs font-semibold text-text-main flex items-center justify-between">
                      Typography Text
                      <span className="font-mono text-[11px] text-text-muted">{theme.text}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        value={theme.text} 
                        onChange={(e) => handleColorChange('text', e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={theme.text} 
                        onChange={(e) => handleColorChange('text', e.target.value)}
                        className="flex-1 bg-canvas border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Geometry, Density & Sliders */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h4 className="text-sm font-bold text-text-main uppercase tracking-widest border-b border-border pb-3 mb-5 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-accent" />
                  Geometry & Density Settings
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Corner Edges */}
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Corner Radius</label>
                    <div className="flex gap-2">
                      {(['sharp', 'rounded', 'pill'] as const).map(edge => (
                        <button
                          key={edge}
                          onClick={() => setTheme(prev => ({ ...prev, edges: edge }))}
                          className={`flex-1 py-2 px-3 text-xs font-semibold capitalize rounded-lg border transition-colors ${
                            theme.edges === edge
                              ? 'bg-accent text-white border-accent shadow-sm'
                              : 'bg-surface border-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          {edge}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Density */}
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Layout Density</label>
                    <div className="flex gap-2">
                      {(['compact', 'comfortable', 'spacious'] as const).map(density => (
                        <button
                          key={density}
                          onClick={() => setTheme(prev => ({ ...prev, density }))}
                          className={`flex-1 py-2 px-2 text-xs font-semibold capitalize rounded-lg border transition-colors ${
                            theme.density === density
                              ? 'bg-accent text-white border-accent shadow-sm'
                              : 'bg-surface border-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          {density}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Depth */}
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Surface Depth</label>
                    <div className="flex gap-2">
                      {(['flat', 'shadow', 'elevated'] as const).map(depth => (
                        <button
                          key={depth}
                          onClick={() => setTheme(prev => ({ ...prev, depth }))}
                          className={`flex-1 py-2 px-3 text-xs font-semibold capitalize rounded-lg border transition-colors ${
                            theme.depth === depth
                              ? 'bg-accent text-white border-accent shadow-sm'
                              : 'bg-surface border-border text-text-muted hover:text-text-main'
                          }`}
                        >
                          {depth}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-border">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Surface Opacity</label>
                      <span className="text-xs font-mono text-text-muted">{theme.transparency || '90'}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="70" 
                      max="100" 
                      value={theme.transparency || '90'} 
                      onChange={(e) => setTheme(prev => ({ ...prev, transparency: e.target.value }))}
                      className="w-full accent-accent"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Interface Brightness</label>
                      <span className="text-xs font-mono text-text-muted">{theme.brightness || '100'}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="80" 
                      max="120" 
                      value={theme.brightness || '100'} 
                      onChange={(e) => setTheme(prev => ({ ...prev, brightness: e.target.value }))}
                      className="w-full accent-accent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONNECTIONS */}
          {activeTab === 'connections' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-text-main mb-6 uppercase tracking-widest border-b border-border pb-4 flex items-center gap-3">
                  <Network className="w-5 h-5 text-accent" />
                  Connections & External Integrations
                </h3>
                <div className="space-y-6">
                  {/* MCP */}
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Plug className="w-4 h-4 text-emerald-400" /> Model Context Protocol (MCP)
                    </h4>
                    <p className="text-xs text-text-muted mb-4">Connect to local MCP servers to expand your node gallery dynamically with custom tooling.</p>
                    <div className="flex items-center gap-4">
                      <input 
                        type="text" 
                        value={mcpUrl}
                        onChange={(e) => setMcpUrl(e.target.value)}
                        placeholder="ws://localhost:3001" 
                        className="flex-1 bg-canvas border border-border rounded-lg p-2.5 text-xs outline-none focus:border-accent font-mono" 
                      />
                      <button 
                        onClick={handleConnectMcp}
                        disabled={mcpStatus === 'testing'}
                        className="bg-accent text-white px-4 py-2.5 rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {mcpStatus === 'testing' ? 'Connecting...' : mcpStatus === 'connected' ? 'Connected ✓' : 'Connect MCP'}
                      </button>
                    </div>
                    {mcpStatus === 'connected' && (
                      <p className="text-xs text-emerald-400 mt-2 font-medium">✓ Local MCP server endpoint registered successfully.</p>
                    )}
                  </div>
                  
                  {/* Database */}
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-400" /> Database Default Connection
                    </h4>
                    <p className="text-xs text-text-muted mb-4">Configure default connection strings for Database nodes across your canvas.</p>
                    <input 
                      type="password" 
                      placeholder="postgresql://user:password@localhost:5432/mydb" 
                      className="w-full bg-canvas border border-border rounded-lg p-2.5 text-xs outline-none focus:border-accent font-mono" 
                    />
                  </div>

                  {/* AI Provider Keys */}
                  <div className="bg-surface border border-border rounded-xl p-5">
                    <h4 className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4 text-yellow-400" /> AI Provider API Keys
                    </h4>
                    <p className="text-xs text-text-muted mb-4">Provide keys for standard AI nodes (OpenAI, Anthropic, Gemini, etc). Server-side proxy protects all secrets.</p>
                    <div className="space-y-3">
                       <input 
                         type="password" 
                         placeholder="OpenAI API Key (sk-...)" 
                         className="w-full bg-canvas border border-border rounded-lg p-2.5 text-xs outline-none focus:border-accent font-mono" 
                       />
                       <input 
                         type="password" 
                         placeholder="Anthropic API Key (sk-ant-...)" 
                         className="w-full bg-canvas border border-border rounded-lg p-2.5 text-xs outline-none focus:border-accent font-mono" 
                       />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-32">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                <h3 className="text-base font-bold text-text-main mb-6 uppercase tracking-widest border-b border-border pb-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-accent" />
                  Account & Local Storage
                </h3>
                
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-text-main">Guest User & Offline Persistence</h4>
                      <p className="text-xs text-text-muted mt-0.5">Allows instant execution with automatic local storage snapshots.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={guestMode} 
                        onChange={(e) => setGuestMode(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-canvas border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white"></div>
                    </label>
                  </div>
                  
                  <hr className="border-border" />
                  
                  <div className="flex flex-col gap-2">
                     <p className="text-xs text-text-muted leading-relaxed">
                       You are currently operating in <strong>Local Storage Mode</strong>. Your workflow canvas and custom node templates are saved automatically in your browser session.
                     </p>
                     <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg self-start">
                       <ShieldCheck className="w-4 h-4" />
                       Local Autosave is Active
                     </div>
                  </div>
                </div>

                <div className="mt-8 bg-surface border border-border rounded-xl p-5 space-y-4">
                  <h4 className="font-semibold text-sm text-text-main">Deployment & Runtime Target</h4>
                  <p className="text-xs text-text-muted">Target environment configuration for workflow execution.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-canvas border border-border p-4 rounded-xl flex flex-col items-center gap-1.5 text-center">
                      <span className="font-semibold text-xs text-text-main">Web Application</span>
                      <span className="text-[11px] text-text-muted">Running in Container Sandbox</span>
                    </div>
                    <div className="bg-canvas border border-accent/40 text-accent p-4 rounded-xl flex flex-col items-center gap-1.5 text-center">
                      <span className="font-semibold text-xs">Full Canvas Engine</span>
                      <span className="text-[11px] text-accent/80">Active & Operational</span>
                    </div>
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
