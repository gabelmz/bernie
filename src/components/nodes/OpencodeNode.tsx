import { NodeProps } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import { CompletionNodeData } from '../../types';
import { CompletionNode } from './CompletionNode';

/** Prompts a session on a local or remote opencode server. */
export function OpencodeNode(props: NodeProps & { data: CompletionNodeData }) {
  return (
    <CompletionNode
      {...props}
      integration="opencode"
      endpoint="/api/opencode/prompt"
      defaultTitle="opencode"
      icon={<Terminal className="w-4 h-4 text-cyan-400" />}
      buttonClass="bg-cyan-700 hover:bg-cyan-600"
      focusClass="focus:border-cyan-400/50"
      runLabel="Send Prompt"
      modelPlaceholder="e.g. anthropic/claude-sonnet-4.5"
    />
  );
}
