import { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { DriveNodeData } from '../../types';
import { getAccessToken } from '../../lib/firebase';
import { Play, FileText, Database, Upload, Search } from 'lucide-react';
import { NodeWrapper, NodeHeader } from './NodeWrapper';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export function DriveNode({ data, id }: NodeProps & { data: DriveNodeData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState(data.fileName || '');
  const [selectedFileId, setSelectedFileId] = useState(data.fileId || '');

  useEffect(() => {
    // Load Picker API
    const loadScript = (src: string, onLoad: () => void) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        onLoad();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = onLoad;
      document.body.appendChild(script);
    };

    loadScript('https://apis.google.com/js/api.js', () => {
      window.gapi.load('picker', { callback: () => {} });
    });
  }, []);

  const openPicker = async () => {
    const token = await getAccessToken();
    if (!token) {
      setError("Please Connect Workspace in the sidebar first.");
      return;
    }
    
    if (!window.google || !window.google.picker) {
      setError("Picker API not loaded yet.");
      return;
    }

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      // @ts-ignore
      .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY || '') // Developer key is needed for picker
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const file = data.docs[0];
          setSelectedFileId(file.id);
          setSelectedFileName(file.name);
          // Optional: update node data via internal event mechanism if needed
        }
      })
      .build();
    picker.setVisible(true);
  };

  const fetchFileData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (data.inputData) {
        // Simple write to Drive
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");
        
        const metadata = {
          name: data.fileName || 'exported_data.json',
          mimeType: 'application/json'
        };
        const fileContent = JSON.stringify(data.inputData);
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));
        
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form
        });
        
        if (!res.ok) throw new Error("Failed to write to Drive");
        const resData = await res.json();
        
        const output = { success: true, fileId: resData.id, message: `Data written to Drive: ${resData.name}` };
        if (data.onDataFetched) data.onDataFetched(id, output);
      } else {
        const targetId = selectedFileId || data.fileId;
        if (!targetId) throw new Error("No file ID selected");
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${data.fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch file content");
        
        const text = await res.text();
        let parsed = text;
        try { parsed = JSON.parse(text); } catch(e) {}
        if (data.onDataFetched) data.onDataFetched(id, parsed);
      }
    } catch (err: any) {
      setError(err.message);
      if (data.onDataFetched) data.onDataFetched(id, { error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data.status === 'running') {
      fetchFileData();
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
          title={data.title || 'Google Drive File'} 
          icon={<Database className="w-4 h-4 text-accent" />} 
          badge={data.inputData ? 'write' : 'read'}
          backgroundColor={data.backgroundColor}
        />
        
        <div className="p-2 flex flex-col gap-2">
          {data.inputData && (
            <div className="text-[13px] bg-orange-950/30 border border-orange-900/50 p-2 rounded text-orange-400 flex items-center gap-1.5">
              <Upload className="w-3 h-3" /> Data ready to write
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">{data.inputData ? 'Target File Name' : 'Selected File'}</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-[15px] border border-border/50 rounded px-3 py-2 bg-surface/50 flex-1 overflow-hidden">
                <FileText className="w-4 h-4 text-text-muted shrink-0" />
                <span className="truncate text-text-main font-medium">{selectedFileName || data.fileName || selectedFileId || data.fileId || 'Root / None'}</span>
              </div>
              {!data.inputData && (
                <button 
                  onClick={openPicker}
                  className="p-2 bg-surface border border-border rounded hover:bg-white/5 transition-colors text-text-muted hover:text-text-main"
                  title="Open Google Picker"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <button 
            onClick={fetchFileData}
            disabled={loading || (!selectedFileId && !data.fileId && !data.inputData)}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-[15px] tracking-wide"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Processing...' : (data.inputData ? 'Write to Drive' : 'Run Extraction')}
          </button>

          {error && <div className="text-[13px] text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">{error}</div>}

          {data.mappedData && (
            <div className="mt-1 pt-3 border-t border-border/50">
              <label className="text-[11px] font-semibold text-text-muted mb-2 block uppercase tracking-widest">Output Data</label>
              <pre className="text-[11px] bg-surface/50 p-3 rounded border border-border/50 max-h-32 overflow-y-auto font-mono text-text-muted shadow-inner">
                {JSON.stringify(data.mappedData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </NodeWrapper>
    </div>
  );
}
