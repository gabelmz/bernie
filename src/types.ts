import { Node, Edge } from '@xyflow/react';

export type NodeType =
  | 'json'
  | 'drive'
  | 'sheet'
  | 'http'
  | 'ai'
  | 'custom'
  | 'text'
  | 'script'
  | 'flush'
  | 'trigger'
  | 'asana'
  | 'keepa'
  | 'supabase'
  | 'insights'
  | 'openrouter'
  | 'huggingface'
  | 'opencode'
  | 'mcp';

export interface BaseNodeData {
  title: string;
  backgroundColor?: string;
  onDataFetched?: (id: string, data: any) => void;
  runWorkflow?: (startNodeId: string) => Promise<void>;
  inputData?: any; // To store data passed from previous nodes
  status?: 'idle' | 'running' | 'success' | 'error';
  errorMessage?: string;
  [key: string]: any;
}

export interface JsonNodeData extends BaseNodeData {
  jsonData: any;
}

export interface DriveNodeData extends BaseNodeData {
  fileId?: string;
  fileName?: string;
  mappedData?: any;
  /** Overrides the folder saved in the Drive integration config. */
  folderId?: string;
  /** Name filter applied when listing a folder. */
  query?: string;
  pageSize?: number;
}

export interface TriggerNodeData extends BaseNodeData {
  triggeredAt?: number;
}

export interface SheetNodeData extends BaseNodeData {
  spreadsheetId?: string;
  sheetName?: string;
  mappedData?: any;
}

export interface HttpNodeData extends BaseNodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string;
  headers?: Record<string, string>;
  requestBody?: string | any;
  response?: any;
}

export interface AiNodeData extends BaseNodeData {
  prompt: string;
  result?: string;
}

export interface TextNodeData extends BaseNodeData {
  text: string;
}

export interface ScriptNodeData extends BaseNodeData {
  script: string;
  result?: any;
}

export interface FlushNodeData extends BaseNodeData {
  flushedData?: any;
}

export interface CustomNodeData extends BaseNodeData {
  config?: any;
}

/** Source node: pulls tasks from Asana. Blank fields fall back to Integrations. */
export interface AsanaNodeData extends BaseNodeData {
  projectGid?: string;
  workspaceGid?: string;
  assigneeGid?: string;
  includeCompleted?: boolean;
  limit?: number;
  rows?: Record<string, any>[];
  rowCount?: number;
  fetchedAt?: string;
}

/** Source node: pulls Amazon product data from Keepa by ASIN. */
export interface KeepaNodeData extends BaseNodeData {
  asins?: string;
  domain?: number;
  statsDays?: number;
  rows?: Record<string, any>[];
  rowCount?: number;
  tokensLeft?: number | null;
  fetchedAt?: string;
}

/** Sink node: writes incoming rows to a Supabase table. */
export interface SupabaseNodeData extends BaseNodeData {
  table?: string;
  mode?: 'insert' | 'upsert';
  onConflict?: string;
  writeResult?: any;
}

/** Sink node: writes incoming rows to a Google Sheets tab. */
export interface SheetsNodeData extends SheetNodeData {
  mode?: 'append' | 'overwrite';
  includeHeaders?: boolean;
}

export interface AiInsight {
  headline?: string;
  summary?: string;
  keyFindings?: { title?: string; detail?: string; impact?: string }[];
  anomalies?: { title?: string; detail?: string; severity?: string }[];
  recommendations?: { action?: string; rationale?: string; priority?: string }[];
}

/**
 * Shared shape for the text-completion nodes (OpenRouter, Hugging Face,
 * opencode). Blank model/prompt fields inherit the saved integration defaults.
 */
export interface CompletionNodeData extends BaseNodeData {
  prompt?: string;
  model?: string;
  systemPrompt?: string;
  sampleSize?: number;
  /** opencode only: reuse a session so successive prompts keep context. */
  sessionId?: string;
}

/**
 * Data for an app-scoped node: which operation it runs, that operation's
 * parameters, and any credentials dropped on this node specifically.
 */
export interface AppNodeData extends BaseNodeData {
  /** Operation id from the registry, e.g. "tasks.list". */
  operation?: string;
  /** Parameters for the selected operation. */
  params?: Record<string, any>;
  /** Secrets scoped to this node, overriding the saved connection. */
  credentials?: Record<string, string>;
  lastRunMeta?: any;
  lastRunCount?: number;
}

/** Tool node: lists or calls the tools an MCP server exposes. */
export interface McpNodeData extends BaseNodeData {
  tool?: string;
  toolArguments?: string | Record<string, any>;
}

/** Analysis node: turns incoming rows into structured AI insights. */
export interface InsightsNodeData extends BaseNodeData {
  focus?: string;
  sampleSize?: number;
  model?: string;
  insights?: AiInsight;
  rowCount?: number;
}
