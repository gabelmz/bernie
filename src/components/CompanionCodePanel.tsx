import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, ListOrdered, Plug } from 'lucide-react';
import { IntegrationId } from '../lib/integrationCore';
import { CompanionOptions, CompanionTarget, companionTargetsFor, generateCompanion } from '../lib/companionCode';

interface CompanionCodePanelProps {
  integration: IntegrationId;
  options: CompanionOptions;
}

/**
 * Shows the deployable companion code for an integration that Bernie cannot
 * reach directly — Apps Script for Google, an Edge Function for Supabase —
 * with the deploy steps and how to point Bernie at the result.
 */
export function CompanionCodePanel({ integration, options }: CompanionCodePanelProps) {
  const targets = companionTargetsFor(integration);
  const [target, setTarget] = useState<CompanionTarget | null>(targets[0] ?? null);
  const [copied, setCopied] = useState<string | null>(null);

  // Regenerate only when the inputs change, so the shared secret stays stable
  // while the panel is open and the instructions keep matching the code.
  const bundle = useMemo(
    () => (target ? generateCompanion(target, options) : null),
    [target, options.spreadsheetId, options.sheetName, options.folderId, options.table, options.onConflict]
  );

  if (targets.length === 0 || !bundle) return null;

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((prev) => (prev === label ? null : prev)), 2000);
    } catch {
      setCopied('failed');
      setTimeout(() => setCopied((prev) => (prev === 'failed' ? null : prev)), 2000);
    }
  };

  const download = (name: string, contents: string) => {
    const blob = new Blob([contents], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-border mt-4">
      <div>
        <h4 className="text-xs font-bold text-text-main uppercase tracking-widest flex items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 text-accent" />
          Companion code
        </h4>
        <p className="text-[11px] text-text-muted leading-relaxed mt-1">{bundle.summary}</p>
      </div>

      {targets.length > 1 && (
        <select
          value={target ?? ''}
          onChange={(e) => setTarget(e.target.value as CompanionTarget)}
          className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
        >
          {targets.map((option) => (
            <option key={option} value={option}>
              {generateCompanion(option, options).title}
            </option>
          ))}
        </select>
      )}

      <div>
        <h5 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <ListOrdered className="w-3 h-3" />
          Deploy it
        </h5>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-text-muted leading-relaxed">
          {bundle.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>

      {bundle.files.map((file) => (
        <div key={file.name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-main">{file.name}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => copy(file.name, file.contents)}
                className="flex items-center gap-1 px-2 py-1 bg-surface border border-border text-text-muted hover:text-text-main rounded text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                {copied === file.name ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === file.name ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => download(file.name, file.contents)}
                className="flex items-center gap-1 px-2 py-1 bg-surface border border-border text-text-muted hover:text-text-main rounded text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                <Download className="w-3 h-3" />
                Save
              </button>
            </div>
          </div>
          <pre className="bg-canvas border border-border rounded-lg p-3 text-[10px] leading-relaxed text-text-main font-mono max-h-64 overflow-auto">
            {file.contents}
          </pre>
        </div>
      ))}

      <div>
        <h5 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <Plug className="w-3 h-3" />
          Point Bernie at it
        </h5>
        <ul className="list-disc pl-5 space-y-1 text-[11px] text-text-muted leading-relaxed">
          {bundle.wireUp.map((line, index) => (
            <li key={index} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      </div>

      {copied === 'failed' && (
        <p className="text-[11px] text-red-400">Could not reach the clipboard. Use Save instead.</p>
      )}
    </div>
  );
}
