import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { CommandPalette } from '@/components/CommandPalette';

const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockGetNodes = vi.fn(() => []);
const mockGetEdges = vi.fn(() => []);
const mockScreenToFlowPosition = vi.fn(({ x, y }) => ({ x, y }));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useReactFlow: () => ({
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      getNodes: mockGetNodes,
      getEdges: mockGetEdges,
      getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
      setViewport: vi.fn(),
      screenToFlowPosition: mockScreenToFlowPosition,
    }),
  };
});

describe('CommandPalette Integration', () => {
  const mockTakeSnapshot = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens and closes with keyboard shortcut (Cmd+K / Ctrl+K and Escape)', () => {
    render(<CommandPalette takeSnapshot={mockTakeSnapshot} />);

    // Initially closed
    expect(screen.queryByPlaceholderText(/Type a command or search/i)).not.toBeInTheDocument();

    // Trigger Ctrl+K
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeInTheDocument();

    // Trigger Escape to close
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByPlaceholderText(/Type a command or search/i)).not.toBeInTheDocument();
  });

  it('filters actions when searching', () => {
    render(<CommandPalette takeSnapshot={mockTakeSnapshot} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });

    const searchInput = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(searchInput, { target: { value: 'clear' } });

    expect(screen.getByText(/Clear Canvas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Export Canvas to JSON/i)).not.toBeInTheDocument();
  });

  it('clears canvas when Clear Canvas action is clicked', () => {
    render(<CommandPalette takeSnapshot={mockTakeSnapshot} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });

    const clearButton = screen.getByText(/Clear Canvas/i);
    fireEvent.click(clearButton);

    expect(mockTakeSnapshot).toHaveBeenCalled();
    expect(mockSetNodes).toHaveBeenCalledWith([]);
    expect(mockSetEdges).toHaveBeenCalledWith([]);
  });
});
