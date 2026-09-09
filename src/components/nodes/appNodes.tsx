import { ReactElement } from 'react';
import { NodeProps } from '@xyflow/react';
import { Bot, CheckCircle2, Database, FolderOpen, Github, Globe, Package, Plug, Shuffle, Sparkles, Table, Terminal } from 'lucide-react';
import { AppNodeData } from '../../types';
import { IntegrationId } from '../../lib/integrationCore';
import { AppNode } from './AppNode';

interface AppNodeStyle {
  integration: IntegrationId;
  icon: ReactElement;
  focusClass: string;
  buttonClass: string;
}

/**
 * Presentation for each app-scoped node. Behaviour lives entirely in AppNode
 * and the operation registry, so a new app is an entry here plus its specs.
 */
export const APP_NODE_STYLES: Record<string, AppNodeStyle> = {
  asana: {
    integration: 'asana',
    icon: <CheckCircle2 className="w-4 h-4 text-rose-500" />,
    focusClass: 'focus:border-rose-500/50',
    buttonClass: 'bg-rose-600 hover:bg-rose-500',
  },
  keepa: {
    integration: 'keepa',
    icon: <Package className="w-4 h-4 text-orange-400" />,
    focusClass: 'focus:border-orange-400/50',
    buttonClass: 'bg-orange-600 hover:bg-orange-500',
  },
  drive: {
    integration: 'drive',
    icon: <FolderOpen className="w-4 h-4 text-amber-400" />,
    focusClass: 'focus:border-amber-400/50',
    buttonClass: 'bg-amber-600 hover:bg-amber-500',
  },
  sheet: {
    integration: 'sheets',
    icon: <Table className="w-4 h-4 text-green-500" />,
    focusClass: 'focus:border-green-500/50',
    buttonClass: 'bg-green-600 hover:bg-green-500',
  },
  supabase: {
    integration: 'supabase',
    icon: <Database className="w-4 h-4 text-emerald-500" />,
    focusClass: 'focus:border-emerald-500/50',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-500',
  },
  github: {
    integration: 'github',
    icon: <Github className="w-4 h-4 text-text-main" />,
    focusClass: 'focus:border-text-muted',
    buttonClass: 'bg-zinc-700 hover:bg-zinc-600',
  },
  openrouter: {
    integration: 'openrouter',
    icon: <Shuffle className="w-4 h-4 text-indigo-400" />,
    focusClass: 'focus:border-indigo-400/50',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-500',
  },
  huggingface: {
    integration: 'huggingface',
    icon: <Bot className="w-4 h-4 text-yellow-400" />,
    focusClass: 'focus:border-yellow-400/50',
    buttonClass: 'bg-yellow-600 hover:bg-yellow-500',
  },
  opencode: {
    integration: 'opencode',
    icon: <Terminal className="w-4 h-4 text-cyan-400" />,
    focusClass: 'focus:border-cyan-400/50',
    buttonClass: 'bg-cyan-700 hover:bg-cyan-600',
  },
  mcp: {
    integration: 'mcp',
    icon: <Plug className="w-4 h-4 text-blue-400" />,
    focusClass: 'focus:border-blue-400/50',
    buttonClass: 'bg-blue-600 hover:bg-blue-500',
  },
  gemini: {
    integration: 'gemini',
    icon: <Sparkles className="w-4 h-4 text-purple-400" />,
    focusClass: 'focus:border-purple-400/50',
    buttonClass: 'bg-purple-600 hover:bg-purple-500',
  },
  apphttp: {
    integration: 'http',
    icon: <Globe className="w-4 h-4 text-emerald-400" />,
    focusClass: 'focus:border-emerald-400/50',
    buttonClass: 'bg-emerald-700 hover:bg-emerald-600',
  },
};

/** The node type a given integration is rendered as on the canvas. */
export function nodeTypeForIntegration(integration: IntegrationId): string | null {
  const entry = Object.entries(APP_NODE_STYLES).find(([, style]) => style.integration === integration);
  return entry ? entry[0] : null;
}

function makeAppNode(nodeType: string) {
  const style = APP_NODE_STYLES[nodeType];
  return function BoundAppNode(props: NodeProps & { data: AppNodeData }) {
    return (
      <AppNode
        {...props}
        integration={style.integration}
        icon={style.icon}
        focusClass={style.focusClass}
        buttonClass={style.buttonClass}
      />
    );
  };
}

export const AsanaAppNode = makeAppNode('asana');
export const KeepaAppNode = makeAppNode('keepa');
export const DriveAppNode = makeAppNode('drive');
export const SheetsAppNode = makeAppNode('sheet');
export const SupabaseAppNode = makeAppNode('supabase');
export const GithubAppNode = makeAppNode('github');
export const OpenRouterAppNode = makeAppNode('openrouter');
export const HuggingFaceAppNode = makeAppNode('huggingface');
export const OpencodeAppNode = makeAppNode('opencode');
export const McpAppNode = makeAppNode('mcp');
export const GeminiAppNode = makeAppNode('gemini');
export const HttpAppNode = makeAppNode('apphttp');
