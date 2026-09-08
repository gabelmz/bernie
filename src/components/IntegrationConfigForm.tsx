import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Save, Plug, Info } from 'lucide-react';
import {
  INTEGRATION_SCHEMAS,
  IntegrationField,
  IntegrationId,
  validateIntegrationConfig,
} from '../lib/integrationCore';
import { postJson } from '../lib/nodeApi';
import { getAccessToken } from '../lib/auth';

interface IntegrationConfigFormProps {
  id: IntegrationId;
  config: Record<string, any>;
  onChange: (id: IntegrationId, config: Record<string, any>) => void;
  onSave: () => void;
}

/**
 * Renders the credential / defaults form for one integration straight from its
 * schema, plus a connection test against the matching server route.
 */
export function IntegrationConfigForm({ id, config, onChange, onSave }: IntegrationConfigFormProps) {
  const schema = INTEGRATION_SCHEMAS[id];
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { valid, missing } = validateIntegrationConfig(id, config);

  const setField = (key: string, value: any) => {
    setTestResult(null);
    onChange(id, { ...config, [key]: value });
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Google integrations authorize with the connected account, not a key.
      const accessToken = schema.requiresGoogleAuth
        ? config.accessToken || (await getAccessToken()) || undefined
        : undefined;
      const result = await postJson('/api/integrations/test', { id, config, accessToken });
      setTestResult({ ok: true, message: result.detail || 'Connection succeeded.' });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const renderField = (field: IntegrationField) => {
    const value = config[field.key];

    if (field.type === 'checkbox') {
      return (
        <label key={field.key} className="flex items-center gap-2 text-sm text-text-main cursor-pointer py-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setField(field.key, e.target.checked)}
            className="accent-accent"
          />
          {field.label}
        </label>
      );
    }

    return (
      <div key={field.key} className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>

        {field.type === 'select' ? (
          <select
            value={value ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const asNumber = Number(raw);
              setField(field.key, raw !== '' && !isNaN(asNumber) ? asNumber : raw);
            }}
            className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent"
          >
            {(field.options || []).map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            value={value ?? ''}
            onChange={(e) => setField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="w-full min-h-[64px] bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono resize-y"
          />
        ) : (
          <input
            type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
            value={value ?? ''}
            onChange={(e) =>
              setField(field.key, field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)
            }
            placeholder={field.placeholder}
            autoComplete="off"
            className="w-full bg-canvas border border-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-accent font-mono"
          />
        )}

        {field.help && <p className="text-[11px] text-text-muted leading-relaxed">{field.help}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="text-xs text-text-muted leading-relaxed">{schema.description}</p>

      {!valid && (
        <div className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Required before nodes can run: {missing.join(', ')}.</span>
        </div>
      )}

      {schema.configOnlyNote && (
        <div className="text-xs bg-surface border border-border text-text-muted rounded-lg p-2.5 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>{schema.configOnlyNote}</span>
        </div>
      )}

      {schema.fields.map(renderField)}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 bg-text-main text-canvas hover:bg-text-main/90 rounded-lg text-xs font-bold tracking-wide transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
        {schema.testable !== false && (
          <button
            onClick={runTest}
            disabled={testing || !valid}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-main hover:border-text-muted rounded-lg text-xs font-bold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>

      {testResult && (
        <div
          className={`text-xs rounded-lg p-2.5 flex items-start gap-2 border ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
}
