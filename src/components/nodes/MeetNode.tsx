import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { getAccessToken } from '../../lib/firebase';
import { Play, Video } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

export function MeetNode({ data, id }: NodeProps & { data: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMeeting = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated with Google. Connect Workspace in the sidebar.");

      const res = await fetch(`https://meet.googleapis.com/v2/spaces`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to create Google Meet space");
      }

      const resData = await res.json();
      const output = { success: true, meetSpaceId: resData.name, meetingUri: resData.meetingUri, message: `Created Google Meet: ${resData.meetingUri}` };
      
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
      createMeeting();
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
          title={data.title || 'Google Meet'} 
          icon={<Video className="w-4 h-4 text-blue-500" />} 
          badge="create"
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          <p className="text-[13px] text-text-muted px-1">Creates a new Google Meet space and returns the joining URI.</p>
          <button 
            onClick={createMeeting}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide mt-2"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Meeting'}
          </button>
          
          {data.status === 'error' && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{data.errorMessage || error}</div>}
          
          {data.mappedData && data.mappedData.meetingUri && (
            <div className="mt-2 pt-3 border-t border-border/50 text-[13px] flex flex-col gap-1.5">
               <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">Meeting URI</label>
               <a href={data.mappedData.meetingUri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                  {data.mappedData.meetingUri}
               </a>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
