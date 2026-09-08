import { useEffect, useState } from 'react';
import { googleSignIn, initAuth, logout } from '../lib/firebase';
import { LogOut, Database, CheckCircle2, Package, Table, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { User } from 'firebase/auth';
import {
  INTEGRATION_IDS,
  IntegrationConfigMap,
  IntegrationId,
  loadIntegrations,
  saveIntegrations,
} from '../lib/integrations';
import { INTEGRATION_SCHEMAS, validateIntegrationConfig } from '../lib/integrationCore';
import { IntegrationConfigForm } from './IntegrationConfigForm';

interface IntegrationsPageProps {
  onClose: () => void;
}

const INTEGRATION_META: Record<IntegrationId, { icon: typeof Database; color: string; bgColor: string }> = {
  asana: { icon: CheckCircle2, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
  keepa: { icon: Package, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  supabase: { icon: Database, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  sheets: { icon: Table, color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

export function IntegrationsPage({ onClose }: IntegrationsPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<IntegrationConfigMap>(() => loadIntegrations());
  const [expanded, setExpanded] = useState<IntegrationId | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (id: IntegrationId, next: Record<string, any>) => {
    setConfigs((prev) => ({ ...prev, [id]: next }));
  };

  const handleSave = (id: IntegrationId) => {
    saveIntegrations(configs);
    setSavedToast(`${INTEGRATION_SCHEMAS[id].name} settings saved.`);
    setTimeout(() => setSavedToast(null), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-6 overflow-y-auto">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-4">Active Connections</h3>

        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mb-8">
          <div className="flex items-center gap-4 text-left w-full">
            <div className="bg-white p-2 rounded-lg shrink-0 h-10 w-10 flex items-center justify-center">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-text-main text-sm">Google Workspace</h4>
              <p className="text-xs text-text-muted mt-0.5">Drive, Sheets, Chat &amp; Meet</p>
            </div>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            {!user ? (
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-text-main text-canvas hover:bg-text-main/90 rounded-lg transition-colors text-sm font-bold tracking-wide flex items-center justify-center gap-2"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-lg border border-border">
                <div className="flex items-center gap-2 overflow-hidden">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-6 h-6 rounded-full border border-border shrink-0" />
                  <span className="text-xs text-text-main font-medium truncate max-w-[100px]">{user.displayName}</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <button
                  onClick={logout}
                  className="p-1 text-text-muted hover:text-red-400 hover:bg-surface rounded transition-colors shrink-0"
                  title="Disconnect"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-4">Integration Settings</h3>

        <div className="flex flex-col gap-3">
          {INTEGRATION_IDS.map((id) => {
            const schema = INTEGRATION_SCHEMAS[id];
            const meta = INTEGRATION_META[id];
            const Icon = meta.icon;
            const isExpanded = expanded === id;
            const { valid } = validateIntegrationConfig(id, configs[id]);

            return (
              <div key={id} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className={`${meta.bgColor} p-2 rounded-lg shrink-0`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-text-main">{schema.name}</h4>
                    <p className="text-[10px] text-text-muted mt-0.5">{schema.description}</p>
                  </div>
                  {valid ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
                      <Check className="w-3 h-3" /> Configured
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-canvas border border-border rounded-full px-2 py-0.5 shrink-0">
                      Not set
                    </span>
                  )}
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

        <p className="text-[11px] text-text-muted mt-6 leading-relaxed">
          Credentials are stored in this browser only and sent with each node run. Nodes leave their own fields blank to
          inherit these defaults.
        </p>
      </div>

      {savedToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-text-main text-canvas px-4 py-2 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          {savedToast}
        </div>
      )}
    </div>
  );
}
