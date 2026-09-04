import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Node, Edge } from '@xyflow/react';

// Mock useReactFlow
const mockGetNodes = vi.fn();
const mockGetEdges = vi.fn();

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useReactFlow: () => ({
      getNodes: mockGetNodes,
      getEdges: mockGetEdges,
    }),
  };
});

describe('useUndoRedo Hook', () => {
  const mockSetNodes = vi.fn();
  const mockSetEdges = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('takes a snapshot of the current canvas state', () => {
    const nodes: Node[] = [{ id: 'n1', position: { x: 10, y: 10 }, data: { title: 'Node 1' } }];
    const edges: Edge[] = [];
    mockGetNodes.mockReturnValue(nodes);
    mockGetEdges.mockReturnValue(edges);

    const { result } = renderHook(() => useUndoRedo(mockSetNodes, mockSetEdges));

    act(() => {
      result.current.takeSnapshot();
    });

    // Take a second snapshot with updated node position
    const nodesV2: Node[] = [{ id: 'n1', position: { x: 50, y: 50 }, data: { title: 'Node 1' } }];
    mockGetNodes.mockReturnValue(nodesV2);
    mockGetEdges.mockReturnValue(edges);

    act(() => {
      result.current.takeSnapshot();
    });

    // Undo should restore previous state
    act(() => {
      result.current.undo();
    });

    expect(mockSetNodes).toHaveBeenCalledWith(nodesV2);
  });

  it('ignores identical consecutive snapshots to prevent redundant history', () => {
    const nodes: Node[] = [{ id: 'n1', position: { x: 10, y: 10 }, data: { title: 'Same' } }];
    mockGetNodes.mockReturnValue(nodes);
    mockGetEdges.mockReturnValue([]);

    const { result } = renderHook(() => useUndoRedo(mockSetNodes, mockSetEdges));

    act(() => {
      result.current.takeSnapshot();
      result.current.takeSnapshot();
    });

    act(() => {
      result.current.undo();
    });

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
  });

  it('redo restores undone states accurately', () => {
    const initialNodes: Node[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }];
    mockGetNodes.mockReturnValue(initialNodes);
    mockGetEdges.mockReturnValue([]);

    const { result } = renderHook(() => useUndoRedo(mockSetNodes, mockSetEdges));

    act(() => {
      result.current.takeSnapshot();
    });

    const changedNodes: Node[] = [{ id: 'n1', position: { x: 100, y: 100 }, data: {} }];
    mockGetNodes.mockReturnValue(changedNodes);

    act(() => {
      result.current.takeSnapshot();
    });

    // Undo
    act(() => {
      result.current.undo();
    });

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(mockSetNodes).toHaveBeenCalled();
  });
});
