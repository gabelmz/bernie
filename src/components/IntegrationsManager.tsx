import { useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  FolderOpen,
  Github,
  Globe,
  Package,
  Plug,
  Shuffle,
  Sparkles,
  Table,
  Terminal,
} from 'lucide-react';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_SCHEMAS,
  IntegrationId,
  integrationsInCategory,
  validateIntegrationConfig,
} from '../lib/integrationCore';
import { IntegrationConfigMap, loadIntegrations, saveIntegrations } from '../lib/integrations';
import { IntegrationConfigForm } from './IntegrationConfigForm';

type IconType = typeof Database;

const INTEGRATION_META: Record<IntegrationId, { icon: IconType; color: string; bgColor: string }> = {
  asana: { icon: CheckCircle2, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
  keepa: { icon: Package, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  drive: { icon: FolderOpen, color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  supabase: { icon: Database, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  sheets: { icon: Table, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  gemini: { icon: Sparkles, color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
  openrouter: { icon: Shuffle, color: 'text-indigo-400', bgColor: 'bg-indigo-400/10' },
  huggingface: { icon: Bot, color: 'text-yellow-400', bgColor: 'bg-yellow-400/10' },
  opencode: { icon: Terminal, color: 'text-cyan-400', bgColor: 'bg-cyan-400/10' },
  github: { icon: Github, color: 'text-text-main', bgColor: 'bg-text-main/10' },
  http: { icon: Globe, color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
  mcp: { icon: Plug, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
};

/**
 * The shared connections editor: every integration in the registry, grouped by
 * category, each expanding into its schema-driven credential form. Used by both
 * the Integrations page and Settings, so there is one place to configure things.
 */
export function IntegrationsManager() {
  const [configs, setConfigs] = useState<IntegrationConfigMap>(() => loadIntegrations());
  const [expanded, setExpanded] = useState<IntegrationId | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const handleConfigChange = (id: IntegrationId, next: Record<string, any>) => {
    setConfigs((prev) => ({ ...prev, [id]: next }));
  };

  const handleSave = (id: IntegrationId) => {
    saveIntegrations(configs);
    setSavedToast(`${INTEGRATION_SCHEMAS[id].name} settings saved.`);
    setTimeout(() => setSavedToast(null), 2500);
  };

  const renderBadge = (id: IntegrationId) => {
    const schema = INTEGRATION_SCHEMAS[id];
    const { valid } = validateIntegrationConfig(id, configs[id]);

    // Drive has no key of its own, so "configured" would always be true and
    // therefore meaningless. Say what it actually depends on instead.
    if (valid && schema.requiresGoogleAuth && schema.requiredKeys.length === 0) {
      return (
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 shrink-0">
          Google Auth
        </span>
      );
    }

    if (valid) {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
          <Check className="w-3 h-3" /> Configured
        </span>
      );
    }

    return (
      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-canvas border border-border rounded-full px-2 py-0.5 shrink-0">
        Not set
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-8 relative">
      {INTEGRATION_CATEGORIES.map((category) => {
        const ids = integrationsInCategory(category.id);
        if (ids.length === 0) return null;

        return (
          <div key={category.id} className="flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">{category.title}</h3>
              <p className="text-[11px] text-text-muted mt-0.5">{category.blurb}</p>
            </div>

            {ids.map((id) => {
              const schema = INTEGRATION_SCHEMAS[id];
              const meta = INTEGRATION_META[id];
              const Icon = meta.icon;
              const isExpanded = expanded === id;

              return (
                <div key={id} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className={`${meta.bgColor} p-2 rounded-lg shrink-0`}>
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-main">{schema.name}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">{schema.description}</p>
                    </div>
                    {renderBadge(id)}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-4 border-t border-border">
                      <IntegrationConfigForm
                        id={id}
                        config={configs[id]}
                        onChange={handleConfigChange}
                        onSave={() => handleSave(id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <p className="text-[11px] text-text-muted leading-relaxed">
        Credentials are stored in this browser only and sent with each node run. Nodes leave their own fields blank to
        inherit these defaults.
      </p>

      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-text-main text-canvas px-4 py-2 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-2 z-[70]">
          <Check className="w-3.5 h-3.5" />
          {savedToast}
        </div>
      )}
    </div>
  );
}
