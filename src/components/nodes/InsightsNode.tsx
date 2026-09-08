import { useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Lightbulb, Sparkles, AlertTriangle, TrendingUp } from 'lucide-react';
import { AiInsight, InsightsNodeData } from '../../types';
import { NodeWrapper, NodeHeader } from './NodeWrapper';
import { toRows } from '../../lib/integrationCore';
import { postJson } from '../../lib/nodeApi';

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-text-muted',
};

function impactColor(level?: string): string {
  return IMPACT_COLORS[String(level || '').toLowerCase()] || 'text-text-muted';
}

/**
 * Analysis node: sends the incoming rows to the insights endpoint and renders
 * the structured result (findings, anomalies, recommendations). The raw
 * insight object is also passed downstream so sinks can persist it.
 */
export function InsightsNode({ data, id }: NodeProps & { data: InsightsNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(data.focus || '');

  const runInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = toRows(data.inputData);
      if (rows.length === 0) {
        throw new Error('No input rows. Connect a source node and run it first.');
      }

      const result = await postJson('/api/ai/insights', {
        rows,
        focus,
        sampleSize: data.sampleSize,
        model: data.model,
      });
      data.onDataFetched?.(id, { insights: result.insights, rowCount: result.rowCount, fields: result.fields });
    } catch (err: any) {
      setError(err.message);
      data.onDataFetched?.(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      runInsights();
    }
  }, [data.status]);

  const payload = data.jsonData && typeof data.jsonData === 'object' ? (data.jsonData as any) : null;
  const insights: AiInsight | null = payload?.insights || data.insights || null;
  const pendingRows = toRows(data.inputData).length;

  return (
    <div className="min-w-[340px] max-w-[400px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <NodeWrapper id={id} data={data}>
        <NodeHeader
          title={data.title || 'AI Insights'}
          icon={<Lightbulb className="w-4 h-4 text-yellow-400" />}
          badge="insights"
          backgroundColor={data.backgroundColor}
        />

        <div className="p-2 flex flex-col gap-2">
          {pendingRows > 0 && (
            <div className="text-[12px] bg-purple-950/30 border border-purple-900/50 p-2 rounded text-purple-300">
              Analysing {pendingRows} row{pendingRows === 1 ? '' : 's'}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Analysis Focus</label>
            <textarea
              className="w-full min-h-[52px] bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-yellow-400/50 resize-y"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Optional: e.g. flag pricing outliers and stalled tasks"
            />
          </div>

          <button
            onClick={runInsights}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Analysing...' : 'Generate Insights'}
          </button>

          {(error || data.status === 'error') && (
            <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error || data.errorMessage}</span>
            </div>
          )}

          {insights && (
            <div className="mt-1 pt-3 border-t border-border/50 flex flex-col gap-3 max-h-72 overflow-y-auto">
              {insights.headline && (
                <div className="text-[14px] font-semibold text-text-main leading-snug">{insights.headline}</div>
              )}
              {insights.summary && (
                <p className="text-[13px] text-text-muted leading-relaxed">{insights.summary}</p>
              )}

              {(insights.keyFindings || []).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Key Findings</h4>
                  {insights.keyFindings!.map((finding, index) => (
                    <div key={index} className="text-[12px] bg-surface/50 border border-border/50 rounded p-2">
                      <span className={`font-semibold ${impactColor(finding.impact)}`}>{finding.title}</span>
                      {finding.detail && <p className="text-text-muted mt-0.5 leading-relaxed">{finding.detail}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(insights.anomalies || []).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Anomalies</h4>
                  {insights.anomalies!.map((anomaly, index) => (
                    <div key={index} className="text-[12px] bg-red-950/20 border border-red-900/40 rounded p-2">
                      <span className={`font-semibold ${impactColor(anomaly.severity)}`}>{anomaly.title}</span>
                      {anomaly.detail && <p className="text-text-muted mt-0.5 leading-relaxed">{anomaly.detail}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(insights.recommendations || []).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Recommendations
                  </h4>
                  {insights.recommendations!.map((rec, index) => (
                    <div key={index} className="text-[12px] bg-emerald-950/20 border border-emerald-900/40 rounded p-2">
                      <span className={`font-semibold ${impactColor(rec.priority)}`}>{rec.action}</span>
                      {rec.rationale && <p className="text-text-muted mt-0.5 leading-relaxed">{rec.rationale}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
