/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Canvas } from './components/Canvas';
import { ThemeProvider } from './contexts/ThemeContext';
import { ReactFlowProvider } from '@xyflow/react';

export default function App() {
  return (
    <ThemeProvider>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </ThemeProvider>
  );
}
