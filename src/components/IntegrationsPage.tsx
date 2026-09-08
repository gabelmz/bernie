import { useEffect, useState } from 'react';
import { googleSignIn, initAuth, logout } from '../lib/firebase';
import { LogOut } from 'lucide-react';
import { User } from 'firebase/auth';
import { IntegrationsManager } from './IntegrationsManager';

interface IntegrationsPageProps {
  onClose: () => void;
}

export function IntegrationsPage({ onClose }: IntegrationsPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

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

        <IntegrationsManager />
      </div>
    </div>
  );
}
