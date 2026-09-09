import { useMemo, useState } from 'react';
import { useReactFlow, Node } from '@xyflow/react';
import { Check, Eye, EyeOff, KeyRound, ExternalLink, Sliders } from 'lucide-react';
import { INTEGRATION_SCHEMAS, IntegrationField, IntegrationId } from '../lib/integrationCore';
import { operationsFor, resolveOperation } from '../lib/operations';
import { credentialFields, hasNodeCredentials, missingCredentials } from '../lib/nodeConfig';

interface NodeOperationFormProps {
  node: Node;
  integration: IntegrationId;
}

/**
 * The edit-pane form for an app-scoped node: pick the operation, fill its
 * parameters, and drop credentials scoped to this node. Every integration gets
 * the same credential block, driven by the schema's password fields, so a key
 * can always be set here without touching the global connection.
 */
export function NodeOperationForm({ node, integration }: NodeOperationFormProps) {
  const { updateNodeData } = useReactFlow();
  const data = node.data as any;
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const schema = INTEGRATION_SCHEMAS[integration];
  const operations = useMemo(() => operationsFor(integration), [integration]);
  const spec = useMemo(() => resolveOperation(integration, data.operation), [integration, data.operation]);

  const secrets = credentialFields(integration);
  const nodeInput = { credentials: data.credentials, params: data.params };
  const missing = missingCredentials(integration, nodeInput);
  const usingNodeKeys = hasNodeCredentials(integration, nodeInput);

  const setParam = (key: string, value: any) => {
    updateNodeData(node.id, { params: { ...(data.params || {}), [key]: value } });
  };

  const setCredential = (key: string, value: string) => {
    const next = { ...(data.credentials || {}) };
    if (value) next[key] = value;
    else delete next[key];
    updateNodeData(node.id, { credentials: next });
  };

  const renderField = (field: IntegrationField, value: any, onChange: (value: any) => void) => {
    const shared =
      'w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent';

    if (field.type === 'checkbox') {
      return (
        <label className="flex items-center gap-2 text-[13px] text-text-main cursor-pointer">
          <input
            type="checkbox"
            checked={value !== false}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-accent"
          />
          {field.label}
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={shared}>
          <option value="">Default</option>
          {(field.options || []).map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${shared} font-mono min-h-[70px] resize-y`}
        />
      );
    }

    if (field.type === 'password') {
      const shown = revealed[field.key];
      return (
        <div className="relative">
          <input
            type={shown ? 'text' : 'password'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            autoComplete="off"
            spellCheck={false}
            className={`${shared} font-mono pr-9`}
          />
          <button
            type="button"
            onClick={() => setRevealed((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
            title={shown ? 'Hide' : 'Reveal'}
          >
            {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
        placeholder={field.placeholder}
        className={`${shared} font-mono`}
      />
    );
  };

  const labelled = (field: IntegrationField, value: any, onChange: (value: any) => void) => (
    <div key={field.key} className="flex flex-col gap-1.5 mb-4">
      {field.type !== 'checkbox' && (
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      {renderField(field, value, onChange)}
      {field.help && <p className="text-[11px] text-text-muted leading-relaxed">{field.help}</p>}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* ------------------------------ operation ------------------------ */}
      <div className="bg-surface/30 border border-border/50 rounded-xl p-4 mb-5">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" />
          {schema?.name || integration} Operation
        </h4>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Operation</label>
          <select
            value={spec?.id || ''}
            onChange={(e) => updateNodeData(node.id, { operation: e.target.value })}
            className="w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent"
          >
            {operations.map((operation) => (
              <option key={operation.id} value={operation.id}>
                {operation.label} · {operation.direction}
              </option>
            ))}
          </select>
          {spec && <p className="text-[11px] text-text-muted leading-relaxed">{spec.summary}</p>}
          {spec?.docsUrl && (
            <a
              href={spec.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-accent hover:underline flex items-center gap-1 self-start"
            >
              <ExternalLink className="w-3 h-3" />
              API reference
            </a>
          )}
        </div>

        {(spec?.fields || []).length > 0 ? (
          <div className="pt-3 border-t border-border/50">
            {(spec?.fields || []).map((field) => labelled(field, data.params?.[field.key], (value) => setParam(field.key, value)))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted pt-3 border-t border-border/50">
            This operation takes no parameters.
          </p>
        )}
      </div>

      {/* ----------------------------- credentials ----------------------- */}
      <div className="bg-surface/30 border border-border/50 rounded-xl p-4">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5" />
          Credentials (this node)
        </h4>
        <p className="text-[11px] text-text-muted leading-relaxed mb-4">
          Anything you set here is used by this node only and overrides the saved connection. Leave blank to inherit
          from Connections &amp; APIs.
        </p>

        {secrets.length === 0 ? (
          <p className="text-[11px] text-text-muted">
            {integration === 'sheets' || integration === 'drive'
              ? 'Google access comes from signing in under Connections & APIs, so there is no key to set here.'
              : 'This integration has no secret fields.'}
          </p>
        ) : (
          <>
            {secrets.map((field) => labelled(field, data.credentials?.[field.key], (value) => setCredential(field.key, String(value ?? ''))))}

            <div className="flex flex-col gap-2 pt-1">
              {usingNodeKeys && (
                <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-2 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  This node is using its own credentials.
                </div>
              )}
              {missing.length > 0 && (
                <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-2">
                  Still missing {missing.join(', ')} — set it here or under Connections &amp; APIs.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
