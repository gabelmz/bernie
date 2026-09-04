import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ReactFlow, 
  Background,
  BackgroundVariant,
  Controls, 
  MiniMap,
  Panel,
  useNodesState, 
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  SelectionMode
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { JsonCardNode } from './nodes/JsonCardNode';
import { DriveNode } from './nodes/DriveNode';
import { HttpNode } from './nodes/HttpNode';
import { AiNode } from './nodes/AiNode';
import { TextNode } from './nodes/TextNode';
import { ScriptNode } from './nodes/ScriptNode';
import { CustomNode } from './nodes/CustomNode';
import { FlushNode } from './nodes/FlushNode';
import { TriggerNode } from './nodes/TriggerNode';
import { SheetNode } from './nodes/SheetNode';
import { ChatNode } from './nodes/ChatNode';
import { MeetNode } from './nodes/MeetNode';
import { SlackNode } from './nodes/SlackNode';
import { GithubNode } from './nodes/GithubNode';
import { NotionNode } from './nodes/NotionNode';
import { StripeNode } from './nodes/StripeNode';
import { WeatherNode } from './nodes/WeatherNode';
import { DatabaseNode } from './nodes/DatabaseNode';
import { MathNode } from './nodes/MathNode';
import { FilterNode } from './nodes/FilterNode';
import { DelayNode } from './nodes/DelayNode';
import { TimerNode } from './nodes/TimerNode';
import { EmailNode } from './nodes/EmailNode';
import { SMSNode } from './nodes/SMSNode';
import { WebhookNode } from './nodes/WebhookNode';
import { TranslateNode } from './nodes/TranslateNode';
import { MapNode } from './nodes/MapNode';
import { DiscordNode } from './nodes/DiscordNode';
import { TemplateEcommerceNode } from './nodes/TemplateEcommerceNode';
import { TemplateDataPipelineNode } from './nodes/TemplateDataPipelineNode';
import { TemplateOnboardingNode } from './nodes/TemplateOnboardingNode';
import { TemplateReportNode } from './nodes/TemplateReportNode';
import { Sidebar } from './Sidebar';
import { NodeEditorPane } from './NodeEditorPane';
import { NavigationBar } from './NavigationBar';
import { CommandPalette } from './CommandPalette';
import dagre from 'dagre';

import { Hexagon, Grid, SlidersHorizontal, Settings2, X, Copy, Trash2, Eye, Play, List, Map, Wand2, Hand, MousePointer2, Group, Magnet, Globe, Sparkles, Check } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 350;
const nodeHeight = 150;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = { ...node };

    newNode.targetPosition = isHorizontal ? ('left' as any) : ('top' as any);
    newNode.sourcePosition = isHorizontal ? ('right' as any) : ('bottom' as any);

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    newNode.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

const nodeTypes = {
  json: JsonCardNode,
  drive: DriveNode,
  sheet: SheetNode,
  http: HttpNode,
  ai: AiNode,
  text: TextNode,
  script: ScriptNode,
  custom: CustomNode,
  flush: FlushNode,
  trigger: TriggerNode,
  chat: ChatNode,
  meet: MeetNode,
  slack: SlackNode,
  github: GithubNode,
  notion: NotionNode,
  stripe: StripeNode,
  weather: WeatherNode,
  database: DatabaseNode,
  math: MathNode,
  filter: FilterNode,
  delay: DelayNode,
  timer: TimerNode,
  email: EmailNode,
  sms: SMSNode,
  webhook: WebhookNode,
  translate: TranslateNode,
  map: MapNode,
  discord: DiscordNode,
  template_ecommerce: TemplateEcommerceNode,
  template_data_pipeline: TemplateDataPipelineNode,
  template_onboarding: TemplateOnboardingNode,
  template_report: TemplateReportNode,
};

const initialNodes: Node[] = [
  {
    id: 'intro',
    type: 'json',
    position: { x: 100, y: 100 },
    data: { 
      title: 'Welcome to Bernie',
      jsonData: {
        message: "Drag nodes from the sidebar.",
        features: ["Google Drive", "HTTP APIs", "AI Automation"]
      } 
    }
  }
];

export function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('bernie-autosave');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.nodes.length > 0) setNodes(parsed.nodes);
        else setNodes(initialNodes);
        
        if (parsed.edges) setEdges(parsed.edges);
      } catch {
        setNodes(initialNodes);
      }
    } else {
      setNodes(initialNodes);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const timeout = setTimeout(() => {
      localStorage.setItem('bernie-autosave', JSON.stringify({ nodes, edges }));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nodes, edges, isLoaded]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Grid Settings
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [gridDensity, setGridDensity] = useState(20);
  const [gridColor, setGridColor] = useState('#27272a');
  const [gridVariant, setGridVariant] = useState<BackgroundVariant>(BackgroundVariant.Lines);
  const [gridTransparency, setGridTransparency] = useState(0.15);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapGridSize, setSnapGridSize] = useState(20);

  // Minimap Settings
  const [showMinimapSettings, setShowMinimapSettings] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [minimapOpacity, setMinimapOpacity] = useState(0.8);
  const [minimapScale, setMinimapScale] = useState(1);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Context Menu State
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; type: 'node' | 'edge' | 'pane' } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { takeSnapshot } = useUndoRedo(setNodes, setEdges);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => { takeSnapshot(); setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)); },
    [setEdges, takeSnapshot]
  );
  /*
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
    */

  const handleNodeDataUpdate = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => {
      const updatedNodes = nds.map(node => {
        if (node.id === nodeId) {
          let updateObj: any = { status: 'success' };
          if (node.type === 'drive') updateObj = { ...updateObj, mappedData: newData };
          else if (node.type === 'sheet') updateObj = { ...updateObj, mappedData: newData };
          else if (node.type === 'chat') updateObj = { ...updateObj, mappedData: newData };
          else if (node.type === 'meet') updateObj = { ...updateObj, mappedData: newData };
          else if (node.type === 'http') updateObj = { ...updateObj, response: newData };
          else if (node.type === 'ai') updateObj = { ...updateObj, result: newData };
          else if (node.type === 'text') updateObj = { ...updateObj, text: newData.text };
          else if (node.type === 'script') updateObj = { ...updateObj, result: newData };
          else if (node.type === 'flush') updateObj = { ...updateObj, flushedData: newData };
          else updateObj = { ...updateObj, jsonData: newData };
          
          if (newData?.error) {
             updateObj.status = 'error';
             updateObj.errorMessage = newData.error;
          }
          
          return { ...node, data: { ...node.data, ...updateObj } };
        }
        return node;
      });

      // Find all target nodes connected from this node
      if (!newData?.error) {
        const outEdges = edges.filter(e => e.source === nodeId);
        if (outEdges.length > 0) {
          const targetIds = outEdges.map(e => e.target);
          return updatedNodes.map(node => {
            if (targetIds.includes(node.id)) {
               return {
                 ...node,
                 data: {
                   ...node.data,
                   inputData: newData,
                   status: 'running'
                 }
               };
            }
            return node;
          });
        }
      }
      return updatedNodes;
    });
  }, [setNodes, edges]);

  const runWorkflow = useCallback((startNodeId: string) => {
    // Just trigger the start node's targets
    handleNodeDataUpdate(startNodeId, { triggeredAt: Date.now() });
  }, [handleNodeDataUpdate]);

  const onAddNode = useCallback((type: string, data: any = {}, position?: { x: number, y: number }) => {
    takeSnapshot();
    const newNode = {
      id: nanoid(),
      type,
      position: position || { 
        x: Math.random() * 200 + 100, 
        y: Math.random() * 200 + 100 
      },
      data: { ...data, onDataFetched: handleNodeDataUpdate, runWorkflow }
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleNodeDataUpdate, runWorkflow]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const typeDataStr = event.dataTransfer.getData('application/reactflow');
      if (!typeDataStr) return;

      try {
        const { type, data } = JSON.parse(typeDataStr);
        
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        onAddNode(type, data, position);
      } catch (err) {
        console.error("Failed to parse dropped node data", err);
      }
    },
    [reactFlowInstance, onAddNode]
  );

  // Context Menu Handlers
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      
      // Calculate position relative to the canvas container
      const pane = canvasRef.current?.getBoundingClientRect();
      if (pane) {
        setMenu({
          id: node.id,
          top: event.clientY - pane.top,
          left: event.clientX - pane.left,
          type: 'node'
        });
      }
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      
      const pane = canvasRef.current?.getBoundingClientRect();
      if (pane) {
        setMenu({
          id: edge.id,
          top: event.clientY - pane.top,
          left: event.clientX - pane.left,
          type: 'edge'
        });
      }
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      
      const pane = canvasRef.current?.getBoundingClientRect();
      if (pane) {
        setMenu({
          id: 'pane',
          top: event.clientY - pane.top,
          left: event.clientX - pane.left,
          type: 'pane'
        });
      }
    },
    []
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  const onPaneClick = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  const saveCustomNode = useCallback(() => {
    if (!menu) return;
    const nodeToSave = nodes.find((n) => n.id === menu.id);
    if (nodeToSave) {
      const customName = (nodeToSave.data.title as string) || `${nodeToSave.type.toUpperCase()} Template`;
      const saved = localStorage.getItem('bernie-custom-nodes');
      let customNodes = saved ? JSON.parse(saved) : [];
      customNodes.push({
        id: Date.now().toString(),
        name: customName,
        type: nodeToSave.type,
        data: { ...nodeToSave.data, title: customName }
      });
      localStorage.setItem('bernie-custom-nodes', JSON.stringify(customNodes));
      showToast(`Saved "${customName}" to Node Gallery!`);
    }
    closeMenu();
  }, [menu, nodes, closeMenu, showToast]);

  const duplicateNode = useCallback(() => {
    if (!menu) return;
    takeSnapshot();
    const nodeToCopy = nodes.find((n) => n.id === menu.id);
    if (nodeToCopy) {
      const newNode = {
        ...nodeToCopy,
        id: nanoid(),
        position: { x: nodeToCopy.position.x + 40, y: nodeToCopy.position.y + 40 },
        selected: false,
      };
      setNodes((nds) => nds.concat(newNode));
    }
    closeMenu();
  }, [menu, nodes, setNodes, closeMenu]);

  const deleteNode = useCallback(() => {
    if (!menu) return;
    takeSnapshot();
    if (menu.type === 'edge') {
      setEdges((eds) => eds.filter((edge) => edge.id !== menu.id));
    } else {
      setNodes((nds) => nds.filter((node) => node.id !== menu.id));
      setEdges((eds) => eds.filter((edge) => edge.source !== menu.id && edge.target !== menu.id));
    }
    closeMenu();
  }, [menu, setNodes, setEdges, closeMenu]);

  const extractHeaders = useCallback(() => {
    if (!menu || menu.type !== 'edge') {
      setNodes((nds) => nds.map((node) => {
        if (node.id === menu?.id) {
           let targetData = node.data.inputData || node.data.jsonData || node.data.mappedData || node.data.response || node.data.flushedData;
           if (targetData) {
              let headers: string[] = [];
              if (Array.isArray(targetData) && targetData.length > 0) {
                 headers = Object.keys(targetData[0]);
              } else if (typeof targetData === 'object' && targetData !== null) {
                 headers = Object.keys(targetData);
              }
              
              // We'll update inputData (or the main payload) to be just the headers
              // Also update status to success to trigger downstreams if needed
              return {
                 ...node,
                 data: {
                    ...node.data,
                    inputData: headers,
                    jsonData: headers, // fallback for json node
                    mappedData: headers, // fallback for drive/sheet
                    response: headers, // fallback for http
                    flushedData: headers, // fallback for flush
                    extractedHeaders: headers
                 }
              };
           }
        }
        return node;
      }));
    }
    closeMenu();
  }, [menu, setNodes, closeMenu]);

  const editNode = useCallback(() => {
    if (!menu) return;
    setEditingNodeId(menu.id);
    closeMenu();
  }, [menu, closeMenu]);

  const onLayout = useCallback(
    (direction: string) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      
      setTimeout(() => {
        reactFlowInstance?.fitView({ duration: 800, padding: 0.2 });
      }, 50);
    },
    [nodes, edges, setNodes, setEdges, reactFlowInstance]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      
      const text = e.clipboardData?.getData('text');
      if (!text) return;
      
      try {
        const parsed = JSON.parse(text);
        onAddNode('json', {
          title: 'Pasted JSON',
          jsonData: parsed
        });
      } catch (err) {
        // Not valid JSON, do nothing
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onAddNode]);

  // Ensure initial nodes have the callback attached
  const nodesWithCallbacks = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      onDataFetched: node.data.onDataFetched || handleNodeDataUpdate,
      runWorkflow: node.data.runWorkflow || runWorkflow
    }
  }));


  const selectedNodes = nodes.filter(n => n.selected);

  const deleteSelectedNodes = useCallback(() => {
    if (!reactFlowInstance) return;
    takeSnapshot();
    reactFlowInstance.deleteElements({ nodes: selectedNodes });
  }, [reactFlowInstance, selectedNodes]);

  const groupSelectedNodes = useCallback(() => {
    const selected = nodes.filter(n => n.selected && !n.parentId);
    if (selected.length < 2) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(n => {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      const nWidth = n.measured?.width ?? 350;
      const nHeight = n.measured?.height ?? 150;
      if (n.position.x + nWidth > maxX) maxX = n.position.x + nWidth;
      if (n.position.y + nHeight > maxY) maxY = n.position.y + nHeight;
    });

    const padding = 40;
    const groupId = nanoid();
    const groupNode = {
      id: groupId,
      type: 'group',
      position: { x: minX - padding, y: minY - padding },
      style: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '2px dashed #6366f1',
        borderRadius: '16px',
        zIndex: -1,
      },
      data: {}
    };

    setNodes(nds => {
      const nextNodes = nds.map(n => {
        if (n.selected && !n.parentId) {
          return {
            ...n,
            parentId: groupId,
            position: {
              x: n.position.x - (minX - padding),
              y: n.position.y - (minY - padding)
            }
          };
        }
        return n;
      });
      return [groupNode, ...nextNodes];
    });
  }, [nodes, setNodes]);

  return (
    <div className="flex h-screen w-full bg-canvas overflow-hidden font-sans relative">
      <CommandPalette takeSnapshot={takeSnapshot} />
      {/* Top Logo */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
        <div className="p-2 border border-border rounded-lg bg-card/80 backdrop-blur-sm shadow-md">
          <Hexagon className="w-5 h-5 text-text-main" strokeWidth={1} />
        </div>
        <span className="text-text-main font-medium tracking-[0.2em] text-sm uppercase shadow-sm">Bernie</span>
      </div>

      <NavigationBar onAddNode={onAddNode} />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-accent/40 text-text-main px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <Check className="w-4 h-4 text-accent" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex-1 relative" ref={canvasRef}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStart={takeSnapshot}
          onSelectionDragStart={takeSnapshot}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
          onEdgeContextMenu={onEdgeContextMenu}
          nodeTypes={nodeTypes}
          className="bg-canvas"
          defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#555', strokeWidth: 2 },
          }}
          snapToGrid={snapToGrid}
          snapGrid={[snapGridSize, snapGridSize]}
          connectionRadius={100}
          connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 3 }}
          panOnDrag={!isSelectionMode}
          selectionOnDrag={isSelectionMode}
          selectionMode={SelectionMode.Partial}
        >
          <Background 
            color={gridColor} 
            style={{ opacity: gridTransparency }} 
            variant={gridVariant} 
            gap={gridDensity} 
            lineWidth={1} 
            size={1.5}
          />
          <Controls className="bg-card border-border shadow-lg rounded overflow-hidden" />
          <Panel position="top-center" className="m-6">
            <div className="bg-card border border-border shadow-lg rounded-xl overflow-hidden flex p-1">
              <button
                onClick={() => setIsSelectionMode(false)}
                className={`p-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${!isSelectionMode ? 'bg-surface text-indigo-500' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
                title="Pan Mode"
              >
                <Hand className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsSelectionMode(true)}
                className={`p-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${isSelectionMode ? 'bg-surface text-indigo-500' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
                title="Select Mode"
              >
                <MousePointer2 className="w-5 h-5" />
              </button>
            </div>
          </Panel>

          {selectedNodes.length > 0 && (
            <Panel position="bottom-center" className="m-6 mb-12">
              <div className="bg-indigo-500 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                <span className="font-medium text-sm">
                  {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''} selected
                </span>
                <div className="w-px h-5 bg-indigo-400/50" />
                <button 
                  onClick={groupSelectedNodes}
                  className="flex items-center gap-2 text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg"
                >
                  <Group className="w-4 h-4" /> Group
                </button>
                <button 
                  onClick={deleteSelectedNodes}
                  className="flex items-center gap-2 text-sm font-medium bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg ml-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </Panel>
          )}

          <Panel position="top-right" className="flex flex-col items-end gap-2 m-6">
            <div className="flex gap-2">
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`border p-2.5 rounded-xl transition-colors shadow-lg ${snapToGrid ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-card border-border text-text-muted hover:text-text-main hover:bg-surface'}`}
                title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
              >
                <Magnet className="w-5 h-5" />
              </button>
              <button
                onClick={() => onLayout('TB')}
                className="bg-card border border-border p-2.5 rounded-xl text-text-muted hover:text-text-main hover:bg-surface transition-colors shadow-lg"
                title="Cleanup Canvas Layout"
              >
                <Wand2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowMinimapSettings(!showMinimapSettings); setShowGridSettings(false); }}
                className={`border p-2.5 rounded-xl transition-colors shadow-lg ${showMinimapSettings ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-card border-border text-text-muted hover:text-text-main hover:bg-surface'}`}
                title="Minimap Settings"
              >
                <Map className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowGridSettings(!showGridSettings); setShowMinimapSettings(false); }}
                className={`border p-2.5 rounded-xl transition-colors shadow-lg ${showGridSettings ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-card border-border text-text-muted hover:text-text-main hover:bg-surface'}`}
                title="Grid Settings"
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>
            
            {showMinimapSettings && (
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-2xl p-5 w-64 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Map className="w-4 h-4" /> Minimap Settings
                  </h3>
                  <button onClick={() => setShowMinimapSettings(false)} className="text-text-muted hover:text-text-main transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Show Minimap</label>
                    <input type="checkbox" checked={showMinimap} onChange={e => setShowMinimap(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                  </div>

                  {showMinimap && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Transparency</label>
                        <input type="range" min="0.1" max="1" step="0.05" value={minimapOpacity} onChange={e => setMinimapOpacity(Number(e.target.value))} className="w-full accent-indigo-500" />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Size (Scale)</label>
                        <input type="range" min="0.5" max="2" step="0.1" value={minimapScale} onChange={e => setMinimapScale(Number(e.target.value))} className="w-full accent-indigo-500" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {showGridSettings && (
              <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-2xl p-5 w-64 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <Grid className="w-4 h-4" /> Grid Customization
                  </h3>
                  <button onClick={() => setShowGridSettings(false)} className="text-text-muted hover:text-text-main transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Visual Grid Density</label>
                    <input type="range" min="10" max="100" value={gridDensity} onChange={e => setGridDensity(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider">Snap to Grid</label>
                    <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                  </div>

                  {snapToGrid && (
                    <div>
                      <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Snap Grid Size ({snapGridSize}px)</label>
                      <input type="range" min="5" max="50" step="1" value={snapGridSize} onChange={e => setSnapGridSize(Number(e.target.value))} className="w-full accent-indigo-500" />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Transparency</label>
                    <input type="range" min="0" max="1" step="0.05" value={gridTransparency} onChange={e => setGridTransparency(Number(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Color</label>
                    <input type="color" value={gridColor} onChange={e => setGridColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border border-border" />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-text-main uppercase tracking-wider block mb-2">Pattern</label>
                    <div className="flex gap-2">
                      <button onClick={() => setGridVariant(BackgroundVariant.Lines)} className={`flex-1 p-2 rounded-lg flex justify-center border transition-colors ${gridVariant === BackgroundVariant.Lines ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-canvas border-border text-text-muted hover:text-text-main'}`}>
                        <div className="w-4 h-4 border-l border-t border-current"></div>
                      </button>
                      <button onClick={() => setGridVariant(BackgroundVariant.Dots)} className={`flex-1 p-2 rounded-lg flex justify-center border transition-colors ${gridVariant === BackgroundVariant.Dots ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-canvas border-border text-text-muted hover:text-text-main'}`}>
                        <div className="w-4 h-4 rounded-full bg-current opacity-50 scale-50"></div>
                      </button>
                      <button onClick={() => setGridVariant(BackgroundVariant.Cross)} className={`flex-1 p-2 rounded-lg flex justify-center border transition-colors ${gridVariant === BackgroundVariant.Cross ? 'bg-surface border-indigo-500/50 text-indigo-500' : 'bg-canvas border-border text-text-muted hover:text-text-main'}`}>
                        <div className="w-4 h-4 relative"><div className="absolute inset-y-0 left-1/2 w-[1.5px] bg-current"></div><div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-current"></div></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Panel>
          {showMinimap && (
            <MiniMap 
              position="bottom-left"
              style={{
                opacity: minimapOpacity,
                transform: `scale(${minimapScale})`,
                transformOrigin: 'bottom left',
                transition: 'opacity 0.2s ease, transform 0.2s ease'
              }}
              nodeColor={(node) => {
                switch (node.type) {
                  case 'drive': return '#f97316'; // orange
                  case 'http': return '#10b981'; // emerald
                  case 'ai': return '#a855f7'; // purple
                  default: return '#27272a';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="border-border rounded-lg shadow-xl bg-card"
            />
          )}
        </ReactFlow>

        {/* Custom Context Menu */}
        {menu && (() => {
          const node = menu.type === 'node' ? nodes.find(n => n.id === menu.id) : null;
          const isTargetNode = node && ['http', 'sheet', 'flush', 'json', 'drive', 'chat', 'meet'].includes(node.type as string);
          
          return (
            <div 
              style={{ top: menu.top, left: menu.left }}
              className="absolute z-50 w-56 bg-card border border-border rounded-xl shadow-2xl py-1 overflow-hidden"
            >
              {menu.type === 'pane' && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-widest">Add Node</div>
                  <button onClick={() => { onAddNode('trigger', { title: 'Trigger' }, { x: menu.left, y: menu.top }); closeMenu(); }} className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"><Play className="w-4 h-4 text-emerald-400" /> Trigger Node</button>
                  <button onClick={() => { onAddNode('http', { title: 'HTTP Request' }, { x: menu.left, y: menu.top }); closeMenu(); }} className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"><Globe className="w-4 h-4 text-blue-400" /> HTTP Request</button>
                  <button onClick={() => { onAddNode('ai', { title: 'AI Agent' }, { x: menu.left, y: menu.top }); closeMenu(); }} className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"><Sparkles className="w-4 h-4 text-purple-400" /> AI Agent</button>
                </>
              )}
              {menu.type === 'node' && (
                <>
                  <button 
                    onClick={editNode}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                  >
                    <Settings2 className="w-4 h-4 text-text-muted" />
                    Edit Node
                  </button>
                  <button 
                    onClick={duplicateNode}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-text-muted" />
                    Duplicate Node
                  </button>
                  <button 
                    onClick={saveCustomNode}
                    className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-text-muted" />
                    Save to Gallery
                  </button>
                  {isTargetNode && (
                    <button 
                      onClick={extractHeaders}
                      className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-surface flex items-center gap-2 transition-colors"
                    >
                      <List className="w-4 h-4 text-text-muted" />
                      Extract Headers
                    </button>
                  )}
                  <div className="h-px bg-border my-1 w-full" />
                  <div className="px-4 py-2">
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-widest flex items-center justify-between mb-2">
                      Opacity
                      <span>{Math.round((node?.data?.opacity as number) ?? 100)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={(node?.data?.opacity as number) ?? 100} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setNodes(nds => nds.map(n => n.id === node?.id ? { ...n, data: { ...n.data, opacity: val } } : n));
                      }}
                      className="w-full accent-accent"
                    />
                  </div>
                  <div className="h-px bg-border my-1 w-full" />
                </>
              )}
              {menu.type !== 'pane' && (
                <button 
                  onClick={deleteNode}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                  {menu.type === 'edge' ? 'Delete Edge' : 'Delete Node'}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      <NodeEditorPane nodeId={editingNodeId} onClose={() => setEditingNodeId(null)} />

      <Sidebar onAddNode={onAddNode} />
    </div>
  );
}
