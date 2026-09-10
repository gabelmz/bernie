import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edge, Node } from '@xyflow/react';
import { Check, Cloud, Code2, Copy, Download, GitBranch, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { generateWorkflowCode } from '../lib/workflowCode';
import { parseMermaid, toMermaid } from '../lib/mermaid';
import { WorkflowSummary, deleteWorkflow, listWorkflows, loadWorkflow, saveWorkflow } from '../lib/workflowStore';

type Tab = 'code' | 'mermaid' | 'saved';

interface WorkflowPanelProps {
  nodes: Node[];
  edges: Edge[];
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onClose: () => void;
  /** Adds an imported graph to the canvas. */
  onImport: (nodes: Node[], edges: Edge[]) => void;
  /** Replaces the canvas with a loaded graph. */
  onReplace: (nodes: Node[], edges: Edge[]) => void;
}

const TABS: { id: Tab; label: string; icon: typeof Code2 }[] = [
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'mermaid', label: 'Mermaid', icon: GitBranch },
  { id: 'saved', label: 'Saved', icon: Cloud },
];

export function WorkflowPanel({ nodes, edges, tab, onTabChange, onClose, onImport, onReplace }: WorkflowPanelProps) {
  const code = useMemo(() => generateWorkflowCode(nodes, edges), [nodes, edges]);

  return (
    <div className="absolute top-0 right-0 h-full w-[min(560px,92vw)] z-20 flex flex-col bg-card border-l border-border shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${
                tab === id ? 'bg-surface text-accent' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-main" title="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'code' && <CodeTab code={code} />}
        {tab === 'mermaid' && <MermaidTab nodes={nodes} edges={edges} onImport={onImport} />}
        {tab === 'saved' && <SavedTab nodes={nodes} edges={edges} onReplace={onReplace} />}
      </div>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={copy}
      className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 bg-surface text-text-muted hover:text-text-main"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function CodeTab({ code }: { code: string }) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <p className="text-[11px] text-text-muted">What runs, in the order it runs.</p>
        <CopyButton text={code} />
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[11.5px] leading-relaxed font-mono text-text-main whitespace-pre">
        {code}
      </pre>
    </>
  );
}

function MermaidTab({
  nodes,
  edges,
  onImport,
}: {
  nodes: Node[];
  edges: Edge[];
  onImport: (nodes: Node[], edges: Edge[]) => void;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const exported = useMemo(() => toMermaid(nodes, edges), [nodes, edges]);

  const importGraph = () => {
    setError(null);
    setWarnings([]);
    try {
      const result = parseMermaid(source);
      onImport(result.nodes, result.edges);
      setWarnings(result.warnings);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Paste a flowchart</label>
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder={'flowchart LR\n  A[Trigger] --> B[Google Sheets]\n  B --> C[Keepa]\n  C --> D[Rank issues]'}
          className="w-full min-h-[160px] bg-surface/50 border border-border/60 rounded-lg p-3 text-[12px] font-mono text-text-main outline-none focus:border-accent/50 resize-y"
        />
        <p className="text-[11px] text-text-muted">
          Labels naming an app (Sheets, Keepa, Asana, Supabase, Drive, GitHub, Gemini, HTTP) become that node. Anything
          else comes in as a note you can retype.
        </p>
      </div>

      <button
        onClick={importGraph}
        disabled={!source.trim()}
        className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 rounded-lg font-semibold text-[14px] disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        Add to canvas
      </button>

      {error && (
        <div className="text-[12px] text-red-400 bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg">{error}</div>
      )}
      {warnings.length > 0 && (
        <ul className="text-[12px] text-amber-400 bg-amber-950/30 border border-amber-900/50 p-2.5 rounded-lg flex flex-col gap-1">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">This canvas</label>
          <CopyButton text={exported} />
        </div>
        <pre className="bg-surface/50 border border-border/60 rounded-lg p-3 text-[11.5px] font-mono text-text-main overflow-x-auto whitespace-pre">
          {exported}
        </pre>
      </div>
    </div>
  );
}

function SavedTab({
  nodes,
  edges,
  onReplace,
}: {
  nodes: Node[];
  edges: Edge[];
  onReplace: (nodes: Node[], edges: Edge[]) => void;
}) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setItems(await listWorkflows());
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const saved = await saveWorkflow({ name: name.trim(), nodes, edges });
      setNote(`Saved "${saved.name}" — ${saved.nodeCount} nodes, ${saved.edgeCount} edges.`);
      setName('');
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const workflow = await loadWorkflow(id);
      if (!workflow.graph) throw new Error('That workflow has no graph stored.');
      onReplace(workflow.graph.nodes, workflow.graph.edges);
      setNote(`Loaded "${workflow.name}".`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteWorkflow(id);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Save this workflow</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && save()}
            placeholder="ASIN issue triage"
            className="flex-1 bg-surface/50 border border-border/60 rounded-lg px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent/50"
          />
          <button
            onClick={save}
            disabled={busy || !name.trim()}
            className="px-4 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            Save
          </button>
        </div>
        <p className="text-[11px] text-text-muted">
          Stored in Cloudflare D1, scoped to the signed-in account. {nodes.length} nodes, {edges.length} edges.
        </p>
      </div>

      {error && (
        <div className="text-[12px] text-red-400 bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg">{error}</div>
      )}
      {note && (
        <div className="text-[12px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-2.5 rounded-lg">
          {note}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Saved workflows</label>
        <button onClick={refresh} className="p-1.5 rounded-lg text-text-muted hover:text-text-main" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {items.length === 0 && <p className="text-[12px] text-text-muted">Nothing saved yet.</p>}

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 bg-surface/40 border border-border/60 rounded-lg px-3 py-2"
          >
            <button onClick={() => open(item.id)} className="flex-1 text-left min-w-0" disabled={busy}>
              <p className="text-[13px] font-semibold text-text-main truncate">{item.name}</p>
              <p className="text-[11px] text-text-muted">
                {item.nodeCount} nodes · {item.edgeCount} edges · {new Date(item.updatedAt).toLocaleString()}
              </p>
            </button>
            <button
              onClick={() => remove(item.id)}
              disabled={busy}
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
