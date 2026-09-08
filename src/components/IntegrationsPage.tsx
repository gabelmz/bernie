import { GoogleAccountCard } from './GoogleAccountCard';
import { IntegrationsManager } from './IntegrationsManager';

interface IntegrationsPageProps {
  onClose: () => void;
}

export function IntegrationsPage({ onClose }: IntegrationsPageProps) {
  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="p-6 overflow-y-auto">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-4">Active Connections</h3>

        <GoogleAccountCard />

        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-widest mb-4">Integration Settings</h3>

        <IntegrationsManager />
      </div>
    </div>
  );
}
