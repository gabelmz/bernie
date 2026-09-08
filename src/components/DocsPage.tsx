import React from 'react';
import { Book, Code, Box, GitBranch, Plug } from 'lucide-react';

export function DocsPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 text-sm text-text-muted">
        <div>
          <h2 className="text-xl font-bold text-text-main mb-4 flex items-center gap-2">
            <Book className="w-5 h-5 text-accent" />
            Bernie Workflow Engine
          </h2>
          <p className="leading-relaxed">
            Welcome to the official documentation for the Bernie Workflow Engine. 
            This visual programming environment allows you to string together APIs, integrations, and logic loops effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text-main flex items-center gap-2 mb-3">
              <Box className="w-4 h-4 text-emerald-400" />
              Node Architecture
            </h3>
            <p className="leading-relaxed mb-3">
              Each node in your canvas is an isolated runner. They receive data from their left (input handles) and emit processed results to their right (output handles).
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Trigger Nodes:</strong> Ignite workflows via events or manual clicks.</li>
              <li><strong>Transform Nodes:</strong> Parse JSON, execute JS, or filter payloads.</li>
              <li><strong>Action Nodes:</strong> Interface with third parties (Slack, HTTP, Google APIs).</li>
            </ul>
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text-main flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-blue-400" />
              Routing & Control Flow
            </h3>
            <p className="leading-relaxed">
              Connections between nodes pass data sequentially. You can branch your flows by connecting one output handle to multiple input handles. The engine executes them in parallel (DAG format).
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-text-main flex items-center gap-2 mb-3">
            <Plug className="w-4 h-4 text-rose-400" />
            Integrations: pull, push, analyse
          </h3>
          <p className="leading-relaxed mb-4">
            Credentials and defaults for Asana, Keepa, Supabase and Google Sheets live on the{' '}
            <strong>Integrations</strong> page (Blocks icon in the left nav). Each integration has a{' '}
            <strong>Test Connection</strong> button, and every node inherits those defaults whenever its own fields are
            left blank, so you set a token once and reuse it across the canvas.
          </p>
          <ul className="list-disc pl-5 space-y-1 mb-4">
            <li><strong>Asana Tasks</strong> and <strong>Keepa Products</strong> are sources: they emit normalized rows.</li>
            <li><strong>Supabase</strong> and <strong>Google Sheets</strong> are sinks: they write the rows they receive.</li>
            <li><strong>AI Insights</strong> analyses incoming rows and returns findings, anomalies and recommendations.</li>
          </ul>
          <p className="leading-relaxed">
            A typical pipeline is <span className="font-mono text-text-main">Keepa → AI Insights → Supabase</span>, or{' '}
            <span className="font-mono text-text-main">Asana → Google Sheets</span>. Run a source node and its rows
            cascade to everything connected downstream.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-text-main flex items-center gap-2 mb-3">
            <Code className="w-4 h-4 text-yellow-400" />
            Extensibility & Custom Nodes
          </h3>
          <p className="leading-relaxed mb-4">
            You can inject custom JavaScript snippets into Script nodes, or use the <strong>Save to Gallery</strong> context menu option to save a configured node for future use. These saved nodes appear in the <strong>Node Gallery</strong> (Puzzle icon in the left nav).
          </p>
          <div className="bg-canvas border border-border rounded-lg p-4 font-mono text-xs text-text-main">
            {`// Example Script Node Logic\nexport default async function run(inputs) {\n  const payload = inputs.data;\n  payload.timestamp = Date.now();\n  return payload;\n}`}
          </div>
        </div>
      </div>
    </div>
  );
}
