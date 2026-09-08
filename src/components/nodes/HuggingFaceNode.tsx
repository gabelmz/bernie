import { NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { CompletionNodeData } from '../../types';
import { CompletionNode } from './CompletionNode';

/** Runs a prompt through the Hugging Face router or a dedicated endpoint. */
export function HuggingFaceNode(props: NodeProps & { data: CompletionNodeData }) {
  return (
    <CompletionNode
      {...props}
      integration="huggingface"
      endpoint="/api/huggingface/complete"
      defaultTitle="Hugging Face"
      icon={<Bot className="w-4 h-4 text-yellow-400" />}
      buttonClass="bg-yellow-600 hover:bg-yellow-500"
      focusClass="focus:border-yellow-400/50"
      runLabel="Run Inference"
      modelPlaceholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
    />
  );
}
