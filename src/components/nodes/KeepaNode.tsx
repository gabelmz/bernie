import { useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Package, Play, AlertTriangle, Settings } from 'lucide-react';
import { KeepaNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { configFor, integrationBlocker, INTEGRATIONS_CHANGED_EVENT } from '../../lib/integrations';
import { KEEPA_DOMAINS, parseAsinList } from '../../lib/integrationCore';
import { postJson } from '../../lib/nodeApi';

/**
 * Source node: pulls Amazon product data from Keepa for a list of ASINs and
 * emits decoded rows (prices in major units, sales rank, rating).
 */
export function KeepaNode({ data, id }: NodeProps & { data: KeepaNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asins, setAsins] = useState(data.asins || '');
  const [blocker, setBlocker] = useState<string | null>(null);

  const buildConfig = useCallback(
    () =>
      configFor('keepa', {
        asins: asins || undefined,
        domain: data.domain,
        statsDays: data.statsDays,
      }),
    [asins, data.domain, data.statsDays]
  );

  useEffect(() => {
    const refresh = () => setBlocker(integrationBlocker('keepa', buildConfig()));
    refresh();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, refresh);
  }, [buildConfig]);

  const runPull = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = buildConfig();
      // An upstream node can supply ASINs, e.g. a JSON list or a mapped column.
      const upstreamAsins = parseAsinList(
        Array.isArray(data.inputData)
          ? data.inputData.map((row: any) => (typeof row === 'string' ? row : row?.asin)).filter(Boolean)
          : data.inputData?.asins
      );

      const result = await postJson('/api/keepa/products', {
        config,
        asins: upstreamAsins.length > 0 ? upstreamAsins : parseAsinList(config.asins),
      });
      data.onDataFetched?.(id, result.rows ?? []);
    } catch (err: any) {
      setError(err.message);
      data.onDataFetched?.(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      runPull();
    }
  }, [data.status]);

  const rows: any[] = Array.isArray(data.jsonData) ? data.jsonData : [];
  const config = buildConfig();
  const domainLabel = KEEPA_DOMAINS.find((d) => d.value === Number(config.domain))?.label || 'amazon.com (US)';
  const asinCount = parseAsinList(asins || config.asins).length;

  return (
    <div className="min-w-[300px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'Keepa Products'}
          icon={<Package className="w-4 h-4 text-orange-400" />}
          badge="source"
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {blocker && (
            <div className="text-[12px] bg-amber-950/30 border border-amber-900/50 p-2 rounded text-amber-400 flex items-start gap-1.5">
              <Settings className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{blocker}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">ASINs</label>
            <textarea
              placeholder="B08N5WRWNW, B07FZ8S74R"
              className="w-full min-h-[60px] bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-orange-400/50 resize-y font-mono"
              value={asins}
              onChange={(e) => setAsins(e.target.value)}
            />
            <p className="text-[11px] text-text-muted">
              {domainLabel} · {asinCount} ASIN{asinCount === 1 ? '' : 's'}
            </p>
          </div>

          <button
            onClick={runPull}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-1"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Fetching products...' : 'Pull Product Data'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-1.5">
              <div className="text-[13px] text-orange-300 bg-orange-950/30 p-2 rounded">
                {rows.length} product{rows.length === 1 ? '' : 's'} ready
              </div>
              <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                {rows.slice(0, 6).map((row: any, index: number) => (
                  <div key={row?.asin || index} className="text-[12px] text-text-muted truncate px-1">
                    {row?.asin} · {row?.buy_box_price ?? row?.amazon_price ?? row?.new_price ?? '—'} · rank {row?.sales_rank ?? '—'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
