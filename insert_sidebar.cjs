const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

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

let items = apps.map(app => `
          <div className="flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:bg-surface/50 p-2 rounded-lg transition-colors border border-transparent hover:border-border/50" onDragStart={(event) => onDragStart(event, '${app.type}', '${app.title}')} draggable>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-card border border-border/50">
                <${app.icon} className="w-3.5 h-3.5 text-text-muted" />
              </div>
              <span className="text-[13px] text-text-main font-medium">${app.title}</span>
            </div>
          </div>`).join('\n');

code = code.replace(
  `{/* Sink */}`,
  `{/* Sink */}\n${items}`
);

const icons = [
  'MessageSquare', 'Github', 'Book', 'CreditCard', 'Cloud', 'Database', 'Calculator',
  'Filter', 'Hourglass', 'Timer', 'Mail', 'Smartphone', 'Webhook', 'Languages', 'Map',
  'MessageCircle', 'ShoppingCart', 'Network', 'UserPlus', 'FileText'
];

code = code.replace(
  `import { Play, Globe, Wand2, Database, MessageCircle, ArrowDownToLine, Code2, GripVertical, FileSpreadsheet } from 'lucide-react';`,
  `import { Play, Globe, Wand2, Database, MessageCircle, ArrowDownToLine, Code2, GripVertical, FileSpreadsheet, ${icons.join(', ')} } from 'lucide-react';`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
