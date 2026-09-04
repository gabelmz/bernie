import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Canvas ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('bernie-autosave');
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-canvas p-6 text-text-main">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="rounded-full bg-red-500/10 p-3 text-red-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
              <p className="text-xs text-text-muted">
                {this.state.error?.message || 'An unexpected error occurred while rendering the workflow canvas.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset & Reload Canvas
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
