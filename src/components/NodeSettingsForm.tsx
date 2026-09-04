import React from 'react';
import { useReactFlow, Node } from '@xyflow/react';

interface NodeSettingsFormProps {
  node: Node;
}

export function NodeSettingsForm({ node }: NodeSettingsFormProps) {
  const { updateNodeData } = useReactFlow();
  const data = node.data as any;

  const handleChange = (key: string, value: any) => {
    updateNodeData(node.id, { [key]: value });
  };

  const renderField = (label: string, key: string, type: 'text' | 'textarea' | 'number' | 'json' = 'text', placeholder?: string) => {
    return (
      <div className="flex flex-col gap-1.5 mb-4">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          {label}
        </label>
        {type === 'textarea' ? (
          <textarea
            value={data[key] || ''}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent font-mono min-h-[100px] resize-y"
            placeholder={placeholder}
          />
        ) : type === 'json' ? (
          <textarea
            value={typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key] || {}, null, 2)}
            onChange={(e) => {
              const val = e.target.value;
              handleChange(key, val);
            }}
            className="w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent font-mono min-h-[150px] resize-y"
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            value={data[key] || ''}
            onChange={(e) => handleChange(key, type === 'number' ? Number(e.target.value) : e.target.value)}
            className="w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent font-mono"
            placeholder={placeholder}
          />
        )}
      </div>
    );
  };

  const renderCommonFields = () => (
    <div className="bg-surface/50 border border-border/50 rounded-xl p-4 mb-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">
          Appearance & Identity
        </h3>
        <span className="text-[10px] font-mono text-text-muted">{node.type} node</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Node Title
        </label>
        <input
          type="text"
          value={data.title || ''}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full bg-surface border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-accent"
          placeholder="Custom Node Title"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Accent Color
        </label>
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', 'transparent'].map(color => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 rounded-full border border-black/30 transition-transform ${
                (data.backgroundColor === color || (!data.backgroundColor && color === 'transparent')) 
                  ? 'ring-2 ring-accent scale-110' 
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: color === 'transparent' ? '#27272a' : color }}
              onClick={() => handleChange('backgroundColor', color)}
              title={color === 'transparent' ? 'Default / Transparent' : color}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderTypeSpecific = () => {
    switch (node.type) {
      case 'http':
        return (
          <div className="flex flex-col">
            {renderField('Method', 'method', 'text', 'GET, POST, etc.')}
            {renderField('URL', 'url', 'text', 'https://api.example.com')}
            {renderField('Headers (JSON)', 'headers', 'json', '{"Authorization": "Bearer ..."}')}
            {renderField('Body', 'requestBody', 'json', '{"key": "value"}')}
          </div>
        );
      case 'ai':
        return (
          <div className="flex flex-col">
            {renderField('Model', 'model', 'text', 'gemini-1.5-pro')}
            {renderField('System Instruction', 'systemInstruction', 'textarea', 'You are a helpful assistant...')}
            {renderField('Prompt', 'prompt', 'textarea', 'Tell me a joke about...')}
          </div>
        );
      case 'script':
        return (
          <div className="flex flex-col">
            {renderField('Script Code', 'script', 'textarea', 'return inputData;')}
          </div>
        );
      case 'text':
        return (
          <div className="flex flex-col">
            {renderField('Text Content', 'text', 'textarea', 'Enter text here...')}
          </div>
        );
      case 'chat':
        return (
          <div className="flex flex-col">
            {renderField('Space ID', 'spaceId', 'text', 'spaces/XXXXXXXXX')}
            {renderField('Message', 'message', 'textarea', 'Hello team!')}
          </div>
        );
      case 'drive':
        return (
          <div className="flex flex-col">
            {renderField('File ID (Optional)', 'fileId', 'text', '1x2y3z...')}
            {renderField('Selected File Name', 'selectedFileName', 'text', 'Report.pdf')}
          </div>
        );
      case 'sheet':
        return (
          <div className="flex flex-col">
            {renderField('Spreadsheet ID', 'spreadsheetId', 'text', '1BxiMvs0XRYFgCE_...')}
            {renderField('Sheet Name', 'sheetName', 'text', 'Sheet1')}
          </div>
        );
      case 'slack':
        return (
          <div className="flex flex-col">
            {renderField('Slack Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'github':
        return (
          <div className="flex flex-col">
            {renderField('GitHub Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'notion':
        return (
          <div className="flex flex-col">
            {renderField('Notion Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'stripe':
        return (
          <div className="flex flex-col">
            {renderField('Stripe Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'weather':
        return (
          <div className="flex flex-col">
            {renderField('Weather Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'database':
        return (
          <div className="flex flex-col">
            {renderField('Database Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'math':
        return (
          <div className="flex flex-col">
            {renderField('Math Ops Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'filter':
        return (
          <div className="flex flex-col">
            {renderField('Filter Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'delay':
        return (
          <div className="flex flex-col">
            {renderField('Delay Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'timer':
        return (
          <div className="flex flex-col">
            {renderField('Timer Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'email':
        return (
          <div className="flex flex-col">
            {renderField('Send Email Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'sms':
        return (
          <div className="flex flex-col">
            {renderField('Send SMS Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'webhook':
        return (
          <div className="flex flex-col">
            {renderField('Webhook Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'translate':
        return (
          <div className="flex flex-col">
            {renderField('Translate Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'map':
        return (
          <div className="flex flex-col">
            {renderField('Map Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'discord':
        return (
          <div className="flex flex-col">
            {renderField('Discord Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'template_ecommerce':
        return (
          <div className="flex flex-col">
            {renderField('E-commerce Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'template_data_pipeline':
        return (
          <div className="flex flex-col">
            {renderField('Data Pipeline Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'template_onboarding':
        return (
          <div className="flex flex-col">
            {renderField('Onboarding Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'template_report':
        return (
          <div className="flex flex-col">
            {renderField('Daily Report Configuration', 'config', 'json', '{}')}
          </div>
        );
      case 'trigger':
        return (
          <div className="flex flex-col">
            {renderField('Interval (Seconds)', 'intervalSeconds', 'number')}
          </div>
        );
      case 'meet':
      case 'flush':
        return (
          <div className="text-center py-6 text-text-muted text-xs">
            No specific parameters required for this node.
          </div>
        );
      case 'json':
        return (
          <div className="text-center py-6 text-text-muted text-xs">
            Use the JSON tab above to inspect and edit this node's payload directly.
          </div>
        );
      default:
        return (
          <div className="text-center py-6 text-text-muted text-xs">
            No custom form parameters available for {node.type}.
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col">
      {renderCommonFields()}
      <div className="bg-surface/30 border border-border/50 rounded-xl p-4">
        <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">
          Node Configuration
        </h4>
        {renderTypeSpecific()}
      </div>
    </div>
  );
}
