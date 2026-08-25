const fs = require('fs');
const path = require('path');

const apps = [
  { name: 'SlackNode', type: 'slack', title: 'Slack', icon: 'MessageSquare', color: 'bg-purple-500/10 border-purple-500/30' },
  { name: 'GithubNode', type: 'github', title: 'GitHub', icon: 'Github', color: 'bg-gray-500/10 border-gray-500/30' },
  { name: 'NotionNode', type: 'notion', title: 'Notion', icon: 'Book', color: 'bg-stone-500/10 border-stone-500/30' },
  { name: 'StripeNode', type: 'stripe', title: 'Stripe', icon: 'CreditCard', color: 'bg-indigo-500/10 border-indigo-500/30' },
  { name: 'WeatherNode', type: 'weather', title: 'Weather', icon: 'Cloud', color: 'bg-sky-500/10 border-sky-500/30' },
  { name: 'DatabaseNode', type: 'database', title: 'Database', icon: 'Database', color: 'bg-blue-500/10 border-blue-500/30' },
  { name: 'MathNode', type: 'math', title: 'Math Ops', icon: 'Calculator', color: 'bg-rose-500/10 border-rose-500/30' },
  { name: 'FilterNode', type: 'filter', title: 'Filter', icon: 'Filter', color: 'bg-amber-500/10 border-amber-500/30' },
  { name: 'DelayNode', type: 'delay', title: 'Delay', icon: 'Hourglass', color: 'bg-slate-500/10 border-slate-500/30' },
  { name: 'TimerNode', type: 'timer', title: 'Timer', icon: 'Timer', color: 'bg-orange-500/10 border-orange-500/30' },
  { name: 'EmailNode', type: 'email', title: 'Send Email', icon: 'Mail', color: 'bg-red-500/10 border-red-500/30' },
  { name: 'SMSNode', type: 'sms', title: 'Send SMS', icon: 'Smartphone', color: 'bg-emerald-500/10 border-emerald-500/30' },
  { name: 'WebhookNode', type: 'webhook', title: 'Webhook', icon: 'Webhook', color: 'bg-cyan-500/10 border-cyan-500/30' },
  { name: 'TranslateNode', type: 'translate', title: 'Translate', icon: 'Languages', color: 'bg-blue-600/10 border-blue-600/30' },
  { name: 'MapNode', type: 'map', title: 'Map', icon: 'Map', color: 'bg-green-500/10 border-green-500/30' },
  { name: 'DiscordNode', type: 'discord', title: 'Discord', icon: 'MessageCircle', color: 'bg-indigo-600/10 border-indigo-600/30' },
  { name: 'TemplateEcommerceNode', type: 'template_ecommerce', title: 'E-commerce', icon: 'ShoppingCart', color: 'bg-fuchsia-500/10 border-fuchsia-500/30' },
  { name: 'TemplateDataPipelineNode', type: 'template_data_pipeline', title: 'Data Pipeline', icon: 'Network', color: 'bg-violet-500/10 border-violet-500/30' },
  { name: 'TemplateOnboardingNode', type: 'template_onboarding', title: 'Onboarding', icon: 'UserPlus', color: 'bg-teal-500/10 border-teal-500/30' },
  { name: 'TemplateReportNode', type: 'template_report', title: 'Daily Report', icon: 'FileText', color: 'bg-yellow-500/10 border-yellow-500/30' }
];

apps.forEach(app => {
  const content = `import { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ${app.icon} } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function ${app.name}({ data, id }: NodeProps & { data: any }) {
  return (
    <div className="min-w-[240px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || '${app.title}'} 
          icon={<${app.icon} className="w-4 h-4 text-text-muted" />} 
          badge="${app.type}"
          backgroundColor={data.backgroundColor}
        />
        <div className="p-3 text-[12px] text-text-muted flex flex-col gap-2">
           <div className="${app.color} p-2 rounded flex items-center justify-center border">
              Configured via Edit Pane
           </div>
           {data.lastResult && (
             <div className="mt-2 text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded truncate">
               {typeof data.lastResult === 'string' ? data.lastResult : JSON.stringify(data.lastResult)}
             </div>
           )}
        </div>
      </NodeWrapper>
    </div>
  );
}`;
  fs.writeFileSync(path.join('src/components/nodes', `${app.name}.tsx`), content);
});

// Write an index export or we can just import them in Canvas.tsx directly
let imports = apps.map(app => `import { ${app.name} } from './nodes/${app.name}';`).join('\n');
let types = apps.map(app => `  ${app.type}: ${app.name},`).join('\n');

fs.writeFileSync('generated_canvas_additions.txt', imports + '\n\n' + types);

let paletteCommands = apps.map(app => `    { name: 'Add ${app.title} Node', action: () => addNode('${app.type}', '${app.title}'), icon: <${app.icon} className="w-4 h-4" /> },`).join('\n');
fs.writeFileSync('generated_palette_additions.txt', paletteCommands);

let settingsForms = apps.map(app => `    case '${app.type}':
      return (
        <div className="flex flex-col">
          {renderField('${app.title} Configuration', 'config', 'json', '{}')}
        </div>
      );`).join('\n');
fs.writeFileSync('generated_settings_additions.txt', settingsForms);

console.log("Nodes generated!");
