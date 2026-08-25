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
        <div className="text-center py-8 text-text-muted text-sm">
          No configuration needed for this node.
        </div>
      );
    case 'json':
      return (
        <div className="text-center py-8 text-text-muted text-[13px]">
          Use the JSON tab to edit this node's data.
        </div>
      );
    default:
      return (
        <div className="text-center py-8 text-text-muted text-sm">
          No form configuration available for {node.type}.
        </div>
      );
  }
}
