import { NodeProps } from '@xyflow/react';
import { Shuffle } from 'lucide-react';
import { CompletionNodeData } from '../../types';
import { CompletionNode } from './CompletionNode';

/** Runs a prompt through OpenRouter's chat completions API. */
export function OpenRouterNode(props: NodeProps & { data: CompletionNodeData }) {
  return (
    <CompletionNode
      {...props}
      integration="openrouter"
      endpoint="/api/openrouter/complete"
      defaultTitle="OpenRouter"
      icon={<Shuffle className="w-4 h-4 text-indigo-400" />}
      buttonClass="bg-indigo-600 hover:bg-indigo-500"
      focusClass="focus:border-indigo-400/50"
      runLabel="Run Completion"
      modelPlaceholder="e.g. anthropic/claude-sonnet-4.5"
    />
  );
}
