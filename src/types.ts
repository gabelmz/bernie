import { Node, Edge } from '@xyflow/react';

export type NodeType = 'json' | 'drive' | 'sheet' | 'http' | 'ai' | 'custom' | 'text' | 'script' | 'flush' | 'trigger';

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
