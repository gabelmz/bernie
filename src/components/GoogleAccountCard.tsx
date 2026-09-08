import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw, Settings } from 'lucide-react';
import {
  AuthUser,
  completeSignInFromRedirect,
  initAuth,
  isAuthConfigured,
  redirectTarget,
  signOut,
  startGoogleSignIn,
} from '../lib/auth';

/**
 * Sign-in card for the Supabase-backed Google account. The Google token it
 * obtains is what the Drive, Sheets, Chat and Meet nodes call Google with, so
 * this card also reports when that token has aged out and needs reconnecting.
 */
export function GoogleAccountCard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consume the tokens Supabase leaves in the URL fragment after it redirects
  // back here. Errors from that round trip are the ones worth showing loudly.
  useEffect(() => {
    try {
      completeSignInFromRedirect();
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setUser(u);
        setGoogleReady(Boolean(token));
      },
      () => {
        setUser(null);
        setGoogleReady(false);
      }
    );
    return unsubscribe;
  }, []);

  const configured = isAuthConfigured();

  const handleSignIn = () => {
    setError(null);
    try {
      startGoogleSignIn({ consent: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm mb-8 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left w-full">
          <div className="bg-white p-2 rounded-lg shrink-0 h-10 w-10 flex items-center justify-center">
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="w-5 h-5"
            />
          </div>
          <div>
            <h4 className="font-semibold text-text-main text-sm">Google via Supabase</h4>
            <p className="text-xs text-text-muted mt-0.5">Authorizes the Drive, Sheets, Chat &amp; Meet nodes</p>
          </div>
        </div>

        <div className="shrink-0 w-full sm:w-auto">
          {!user ? (
            <button
              onClick={handleSignIn}
              disabled={!configured}
              className="w-full sm:w-auto px-4 py-2 bg-text-main text-canvas hover:bg-text-main/90 rounded-lg transition-colors text-sm font-bold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sign in with Google
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-lg border border-border">
              <div className="flex items-center gap-2 overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full border border-border shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-surface border border-border shrink-0" />
                )}
                <span className="text-xs text-text-main font-medium truncate max-w-[140px]">
                  {user.name || user.email || 'Signed in'}
                </span>
              </div>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => signOut()}
                className="p-1 text-text-muted hover:text-red-400 hover:bg-surface rounded transition-colors shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!configured && (
        <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg p-2.5 flex items-start gap-2">
          <Settings className="w-4 h-4 shrink-0 mt-px" />
          <span>Set the Supabase project URL below before signing in.</span>
        </div>
      )}

      {configured && !user && (
        <p className="text-[11px] text-text-muted leading-relaxed">
          Requires Google enabled under Authentication, Providers on your Supabase project, and{' '}
          <code className="font-mono text-text-main">{redirectTarget()}</code> listed under Authentication, URL
          Configuration, Redirect URLs.
        </p>
      )}

      {user && !googleReady && (
        <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <div className="flex-1">
            <p>
              Signed in, but the Google access token has expired. Google tokens last an hour and Supabase does not
              refresh them, so Drive and Sheets nodes need a reconnect.
            </p>
            <button
              onClick={handleSignIn}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-main hover:border-text-muted rounded-lg text-[11px] font-bold tracking-wide transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reconnect Google
            </button>
          </div>
        </div>
      )}

      {user && googleReady && (
        <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg p-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Google access is live. Drive and Sheets nodes can run.</span>
        </div>
      )}

      {error && (
        <div className="text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
