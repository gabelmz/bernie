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
  | 'insights';

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

/** Analysis node: turns incoming rows into structured AI insights. */
export interface InsightsNodeData extends BaseNodeData {
  focus?: string;
  sampleSize?: number;
  model?: string;
  insights?: AiInsight;
  rowCount?: number;
}
