import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { getAccessToken } from '../../lib/firebase';
import { Play, MessageCircle, Database } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function ChatNode({ data, id }: NodeProps & { data: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState(data.spaceId || '');
  const [message, setMessage] = useState(data.message || '');

  const runAction = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated with Google. Connect Workspace in the sidebar.");
      
      const payloadMessage = data.inputData ? (typeof data.inputData === 'object' ? JSON.stringify(data.inputData) : data.inputData) : message;

      if (!spaceId) throw new Error("Please provide a Space ID");
      if (!payloadMessage) throw new Error("Please provide a message to send");

      const res = await fetch(`https://chat.googleapis.com/v1/spaces/${spaceId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: payloadMessage
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to send message to Google Chat");
      }

      const resData = await res.json();
      const output = { success: true, messageId: resData.name, message: `Sent message to Google Chat space: ${spaceId}` };
      
      if (data.onDataFetched) {
        data.onDataFetched(id, output);
      }
    } catch (err: any) {
      setError(err.message);
      if (data.onDataFetched) {
        data.onDataFetched(id, { error: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      runAction();
    }
  }, [data.status]);

  return (
    <div className="min-w-[280px] font-sans">
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      
      <NodeWrapper id={id} data={data}>
        <NodeHeader 
          title={data.title || 'Google Chat'} 
          icon={<MessageCircle className="w-4 h-4 text-emerald-500" />} 
          badge="send"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          {data.inputData && (
            <div className="text-[13px] bg-emerald-950/30 border border-emerald-900/50 p-2 rounded text-emerald-400 flex items-center gap-1.5">
              <Database className="w-3 h-3" /> Input data will be sent as message
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Space ID</label>
            <input 
              type="text"
              placeholder="e.g. spaces/AAAAxxx"
              className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-emerald-500/50"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
            />
          </div>
          {!data.inputData && (
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Message</label>
              <textarea 
                placeholder="Hello from Bernie!"
                className="w-full bg-surface/50 border border-border/50 rounded px-3 py-2 text-[13px] text-text-main outline-none focus:border-emerald-500/50 resize-y"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          )}
          <button 
            onClick={runAction}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Sending...' : 'Send Message'}
          </button>
          
          {data.status === 'error' && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{data.errorMessage || error}</div>}
          
          {data.mappedData && (
            <div className="mt-1 pt-3 border-t border-border/50 text-[13px] text-green-400 bg-green-950/30 p-2 rounded text-center">
              Message sent successfully!
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
