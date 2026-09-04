import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MathNode } from '@/components/nodes/MathNode';
import { ScriptNode } from '@/components/nodes/ScriptNode';
import { TextNode } from '@/components/nodes/TextNode';
import { DriveNode } from '@/components/nodes/DriveNode';

// Mock handles and XYFlow hooks
vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="flow-handle" />,
  NodeToolbar: ({ children }: { children: React.ReactNode }) => <div data-testid="node-toolbar">{children}</div>,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useReactFlow: () => ({
    updateNodeData: vi.fn(),
  }),
}));

describe('Node Components Integration', () => {
  it('renders MathNode with custom title and result display', () => {
    const data = {
      title: 'Multiplier Op',
      lastResult: 144,
      status: 'idle',
    };

    render(<MathNode id="math-1" type="math" data={data} {...({} as any)} />);

    expect(screen.getByText('Multiplier Op')).toBeInTheDocument();
    expect(screen.getByText('144')).toBeInTheDocument();
  });

  it('renders ScriptNode, allows script input, and triggers execution on button click', () => {
    const onDataFetched = vi.fn();
    const data = {
      title: 'Custom Logic',
      script: 'return input.a + input.b;',
      inputData: { a: 10, b: 20 },
      onDataFetched,
    };

    render(<ScriptNode id="script-1" type="script" data={data} {...({} as any)} />);

    expect(screen.getByText('Custom Logic')).toBeInTheDocument();
    const runButton = screen.getByRole('button', { name: /Run Script/i });
    expect(runButton).toBeInTheDocument();

    fireEvent.click(runButton);
    expect(onDataFetched).toHaveBeenCalledWith('script-1', 30);
  });

  it('handles script errors gracefully without crashing the app', () => {
    const onDataFetched = vi.fn();
    const data = {
      title: 'Erroneous Script',
      script: 'throw new Error("Deliberate test failure");',
      inputData: {},
      onDataFetched,
    };

    render(<ScriptNode id="script-2" type="script" data={data} {...({} as any)} />);

    const runButton = screen.getByRole('button', { name: /Run Script/i });
    fireEvent.click(runButton);

    expect(onDataFetched).toHaveBeenCalledWith('script-2', {
      error: 'Deliberate test failure',
    });
    expect(screen.getByText('Deliberate test failure')).toBeInTheDocument();
  });

  it('renders TextNode and displays interpolated or rendered content', () => {
    const data = {
      title: 'Summary Text',
      text: 'Workflow executed successfully.',
    };

    render(<TextNode id="text-1" type="text" data={data} {...({} as any)} />);
    expect(screen.getByText('Summary Text')).toBeInTheDocument();
    expect(screen.getByText('Workflow executed successfully.')).toBeInTheDocument();
  });

  it('renders DriveNode without throwing unhandled exceptions when Google Picker is absent', () => {
    const data = {
      title: 'Google Drive File',
      fileId: 'file-12345',
    };

    expect(() => {
      render(<DriveNode id="drive-1" type="drive" data={data} {...({} as any)} />);
    }).not.toThrow();

    expect(screen.getByText('Google Drive File')).toBeInTheDocument();
  });
});
