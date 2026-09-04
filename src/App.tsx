/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from './components/Canvas';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
