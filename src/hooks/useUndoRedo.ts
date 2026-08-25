import { useCallback, useEffect, useState } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';

export function useUndoRedo(
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void
) {
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const { getNodes, getEdges } = useReactFlow();
  
  const takeSnapshot = useCallback(() => {
    setPast((p) => {
      const currentState = { nodes: getNodes(), edges: getEdges() };
      if (p.length > 0) {
        const last = p[p.length - 1];
        if (JSON.stringify(last) === JSON.stringify(currentState)) return p;
      }
      return [...p.slice(-49), currentState]; 
    });
    setFuture([]);
  }, [getNodes, getEdges]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const newPast = [...p];
      const previousState = newPast.pop()!;
      setFuture((f) => [{ nodes: getNodes(), edges: getEdges() }, ...f]);
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      return newPast;
    });
  }, [getNodes, getEdges, setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const newFuture = [...f];
      const nextState = newFuture.shift()!;
      setPast((p) => [...p, { nodes: getNodes(), edges: getEdges() }]);
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      return newFuture;
    });
  }, [getNodes, getEdges, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return { undo, redo, takeSnapshot };
}
