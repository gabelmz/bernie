/**
 * Declarative operation specs. One entry per API call an integration can make,
 * describing both the form the node renders and the HTTP request the server
 * builds — so adding a call type is a spec entry, not a new handler and route.
 */

import { IntegrationField, IntegrationId } from '../integrationCore';

/** How an operation moves data, which drives the node's badges and validation. */
export type OperationDirection =
  /** Reads from the app and emits rows. */
  | 'pull'
  /** Writes the incoming rows to the app. */
  | 'push'
  /** Reads a bounded sample, for looking before you write. */
  | 'preview'
  /** Changes something without consuming rows (create, delete, dispatch). */
  | 'mutate'
  /** Free-form request against the app's API, for anything not named above. */
  | 'raw';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** How the request body is assembled. */
export type BodySource =
  /** No body. */
  | 'none'
  /** The rows arriving on the node's input, as a JSON array. */
  | 'rows'
  /** The operation's own parameters, as a JSON object. */
  | 'params'
  /** A JSON object typed into a parameter field, sent verbatim. */
  | 'rawBody'
  /** Asana wraps writes in `{ data: ... }`. */
  | 'asanaData'
  /** Sheets values calls wrap rows in `{ range, majorDimension, values }`. */
  | 'sheetValues';

/** Post-processing applied to the response before it flows downstream. */
export type ResultShape =
  /** Rows straight through, after `resultPath`. */
  | 'rows'
  /** Asana task objects flattened. */
  | 'asanaTasks'
  /** Keepa product objects decoded. */
  | 'keepaProducts'
  /** A Sheets `values` matrix turned into rows using the first row as headers. */
  | 'sheetValues'
  /** Drive file metadata flattened. */
  | 'driveFiles'
  /** A single object reported as one row. */
  | 'single'
  /** Passed through untouched (for raw requests). */
  | 'passthrough';

export interface OperationSpec {
  /** Stable id stored on the node, e.g. "tasks.list". */
  id: string;
  label: string;
  direction: OperationDirection;
  /** One line shown under the operation picker. */
  summary: string;
  /** Link to the vendor's reference for this call. */
  docsUrl?: string;

  /** Parameters beyond the credentials, rendered in the node's edit view. */
  fields?: IntegrationField[];

  method: HttpMethod;
  /**
   * Path appended to the integration's base URL. `{name}` placeholders are
   * filled from the operation parameters and are required.
   */
  path: string;
  /** Parameter keys sent as query string values when set. */
  query?: string[];
  body?: BodySource;
  /** Dot path to the payload the result shape should read, e.g. "data". */
  resultPath?: string;
  result?: ResultShape;

  /** True when the operation needs rows on the node's input. */
  consumesRows?: boolean;
  /** True when the operation emits rows downstream. */
  emitsRows?: boolean;

  /**
   * Set when the operation cannot be expressed as one REST call and the server
   * handles it specially (MCP JSON-RPC, the Gemini SDK, Sheets previews).
   */
  custom?: string;
}

export interface IntegrationOperations {
  integration: IntegrationId;
  /** Operation selected when a node is first dropped. */
  defaultOperation: string;
  operations: OperationSpec[];
}

/** Convenience for the many operations that take a single free-text field. */
export function textField(
  key: string,
  label: string,
  placeholder?: string,
  help?: string,
  required = false
): IntegrationField {
  return { key, label, type: 'text', placeholder, help, required };
}

export function jsonField(key: string, label: string, placeholder?: string, help?: string): IntegrationField {
  return { key, label, type: 'textarea', placeholder, help };
}

export function numberField(key: string, label: string, placeholder?: string, help?: string): IntegrationField {
  return { key, label, type: 'number', placeholder, help };
}

/** The raw-request escape hatch every REST integration gets. */
export function rawOperation(docsUrl: string, pathPlaceholder: string): OperationSpec {
  return {
    id: 'raw.request',
    label: 'Raw API request',
    direction: 'raw',
    summary: 'Call any endpoint this app exposes, using the credentials on this node.',
    docsUrl,
    method: 'GET',
    path: '',
    body: 'rawBody',
    result: 'passthrough',
    emitsRows: true,
    fields: [
      {
        key: 'rawMethod',
        label: 'Method',
        type: 'select',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      textField('rawPath', 'Path', pathPlaceholder, 'Appended to the API base URL. Include a leading slash.', true),
      jsonField('rawQuery', 'Query (JSON)', '{"limit": 50}'),
      jsonField('rawBody', 'Body (JSON)', '{"name": "example"}', 'Ignored for GET. Leave blank to send the input rows.'),
    ],
  };
}
