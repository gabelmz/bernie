import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Server } from 'lucide-react';
import { apiBase, apiKey, setApiBase, setApiKey } from '../lib/apiBase';

type Probe = { state: 'idle' | 'checking' | 'ok' | 'bad'; detail?: string };

/**
 * Where this browser sends API calls.
 *
 * Served by `npm run dev` there is nothing to set: Express is the same origin.
 * Served by anything static — AI Studio, a built dist/, Pages — there is no
 * Express process behind the page, so every POST to /api/* is answered by a
 * file server with 405 and no node can run. That is what this card fixes:
 * point it at the deployed Worker and the app has a real API again.
 */
export function ApiEndpointCard() {
  const [base, setBase] = useState(apiBase());
  const [key, setKey] = useState(apiKey());
  const [saved, setSaved] = useState(false);
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });

  // A page served statically cannot answer a POST, so say so before the user
  // discovers it one failed node at a time.
  const [sameOriginBroken, setSameOriginBroken] = useState(false);
  useEffect(() => {
    if (apiBase()) return;
    let cancelled = false;
    fetch('/api/health', { method: 'GET' })
      .then((response) => {
        if (!cancelled) setSameOriginBroken(!response.ok && response.status !== 404);
      })
      .catch(() => {
        if (!cancelled) setSameOriginBroken(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = () => {
    setApiBase(base);
    setApiKey(key);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const test = async () => {
    setProbe({ state: 'checking' });
    const target = base.replace(/\/+$/, '');
    try {
      const health = await fetch(`${target || ''}/api/health`);
      if (!health.ok) {
        setProbe({ state: 'bad', detail: `Health check returned ${health.status}.` });
        return;
      }

      // Health is deliberately unauthenticated, so check the key separately
      // against a route that is gated.
      const guarded = await fetch(`${target || ''}/api/workflows`, {
        headers: key ? { 'X-Bernie-Key': key } : {},
      });

      if (guarded.status === 401) {
        setProbe({ state: 'bad', detail: 'Reachable, but that key was rejected.' });
        return;
      }
      if (guarded.status === 503) {
        setProbe({ state: 'bad', detail: 'Reachable, but it has no shared secret configured.' });
        return;
      }
      if (!guarded.ok) {
        setProbe({ state: 'bad', detail: `Workflow store returned ${guarded.status}.` });
        return;
      }

      setProbe({ state: 'ok', detail: 'Reachable, and the key was accepted.' });
    } catch (err: any) {
      setProbe({ state: 'bad', detail: err?.message || 'Could not reach it at all.' });
    }
  };

  return (
    <div className="bg-surface/40 border border-border/60 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-2.5 mb-3">
        <Server className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <div>
          <h4 className="text-[14px] font-semibold text-text-main">API endpoint</h4>
          <p className="text-[12px] text-text-muted leading-relaxed">
            Leave blank when this page is served by <code>npm run dev</code>. On a static host there is no API behind
            the page, so point this at the deployed Worker.
          </p>
        </div>
      </div>

      {sameOriginBroken && !base && (
        <div className="text-[12px] text-amber-400 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-lg mb-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            This page is not being served by the Bernie API, so node runs will fail with 405. Set the Worker URL below.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Worker URL</label>
        <input
          value={base}
          onChange={(event) => setBase(event.target.value)}
          placeholder="https://bernie-api.<your-subdomain>.workers.dev"
          className="w-full bg-surface/60 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent/50"
        />

        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mt-1">API key</label>
        <input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          type="password"
          placeholder="The BERNIE_API_SECRET set on the Worker"
          className="w-full bg-surface/60 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent/50"
        />

        <div className="flex gap-2 mt-1">
          <button
            onClick={save}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-[13px] flex items-center gap-1.5"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={test}
            className="px-4 py-2 rounded-lg bg-surface border border-border/60 text-text-main font-semibold text-[13px] flex items-center gap-1.5"
          >
            {probe.state === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Test
          </button>
        </div>

        {probe.state === 'ok' && (
          <p className="text-[12px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-2 rounded-lg">
            {probe.detail}
          </p>
        )}
        {probe.state === 'bad' && (
          <p className="text-[12px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded-lg">{probe.detail}</p>
        )}
      </div>
    </div>
  );
}
