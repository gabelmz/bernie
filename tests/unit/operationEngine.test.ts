import { describe, it, expect } from 'vitest';
import {
  buildOperationRequest,
  parseFilterLines,
  readResultPath,
  resolveParam,
  sheetValuesToRows,
  transportFor,
} from '@/lib/operationEngine';
import { findOperation, operationsFor } from '@/lib/operations';

/** Builds a request for one operation, keeping the tests terse. */
function build(
  integration: any,
  operationId: string,
  params: Record<string, any> = {},
  config: Record<string, any> = {},
  rows: Record<string, any>[] = []
) {
  const spec = findOperation(integration, operationId);
  if (!spec) throw new Error(`no such operation: ${integration}/${operationId}`);
  return buildOperationRequest({ integration, spec, params, config, rows });
}

describe('Transports', () => {
  it('authenticates each app the way its API expects', () => {
    expect(transportFor('asana', { accessToken: 't' }).headers.Authorization).toBe('Bearer t');

    const supabase = transportFor('supabase', { url: 'https://x.supabase.co', apiKey: 'k' });
    expect(supabase.headers.apikey).toBe('k');
    expect(supabase.headers.Authorization).toBe('Bearer k');

    const github = transportFor('github', { token: 'ghp' });
    expect(github.headers.Accept).toBe('application/vnd.github+json');
    expect(github.baseUrl).toBe('https://api.github.com');

    // Keepa puts its key in the query string, so no auth header.
    expect(transportFor('keepa', { apiKey: 'k' }).headers.Authorization).toBeUndefined();
  });

  it('uses the Google sign-in token for Sheets and Drive', () => {
    expect(transportFor('sheets', {}, 'ya29.tok').headers.Authorization).toBe('Bearer ya29.tok');
    expect(transportFor('drive', {}, 'ya29.tok').baseUrl).toBe('https://www.googleapis.com');
  });

  it('explains what is missing rather than building a broken request', () => {
    expect(() => transportFor('asana', {})).toThrow(/personal access token is required/i);
    expect(() => transportFor('supabase', {})).toThrow(/project URL is required/i);
    expect(() => transportFor('supabase', { url: 'https://x.supabase.co' })).toThrow(/API key is required/i);
    expect(() => transportFor('sheets', {})).toThrow(/Sign in with Google|companion code/i);
    expect(() => transportFor('github', {})).toThrow(/access token is required/i);
  });

  it('honours a self-hosted base URL for GitHub Enterprise', () => {
    expect(transportFor('github', { token: 't', apiBaseUrl: 'https://ghe.corp/api/v3/' }).baseUrl).toBe(
      'https://ghe.corp/api/v3'
    );
  });
});

describe('Parameter resolution', () => {
  it('prefers the node parameter, then the connection default', () => {
    expect(resolveParam('asana', 'project', { project: '1' }, { projectGid: '2' })).toBe('1');
    expect(resolveParam('asana', 'project', {}, { projectGid: '2' })).toBe('2');
    expect(resolveParam('asana', 'project', { project: '  ' }, { projectGid: '2' })).toBe('2');
    expect(resolveParam('asana', 'project', {}, {})).toBeUndefined();
  });

  it('falls back to a literal default when nothing else supplies one', () => {
    // A Sheets node with only a spreadsheet id still targets the first tab.
    expect(resolveParam('sheets', 'range', {}, {})).toBe('Sheet1');
    expect(resolveParam('keepa', 'domain', {}, {})).toBe(1);
    // The stored config still wins over the literal fallback.
    expect(resolveParam('sheets', 'range', {}, { sheetName: 'Other' })).toBe('Other');
  });

  it('maps a parameter onto the differently-named config key', () => {
    // The Sheets range falls back to the configured default tab.
    expect(resolveParam('sheets', 'range', {}, { sheetName: 'Tasks' })).toBe('Tasks');
    expect(resolveParam('keepa', 'stats', {}, { statsDays: 90 })).toBe(90);
  });
});

describe('Request building', () => {
  it('fills path placeholders and query parameters', () => {
    const request = build('asana', 'tasks.get', { taskGid: '42', opt_fields: 'gid,name' }, { accessToken: 't' });

    expect(request.method).toBe('GET');
    expect(request.url).toContain('/api/1.0/tasks/42?');
    expect(new URL(request.url).searchParams.get('opt_fields')).toBe('gid,name');
    expect(request.body).toBeUndefined();
  });

  it('names the missing placeholder instead of calling a malformed URL', () => {
    expect(() => build('asana', 'tasks.get', {}, { accessToken: 't' })).toThrow(/missing taskGid/i);
  });

  it('takes a path placeholder from the connection default', () => {
    const request = build('asana', 'tasks.search', { text: 'billing' }, { accessToken: 't', workspaceGid: '77' });
    expect(request.url).toContain('/workspaces/77/tasks/search');
  });

  it('wraps Asana writes in a data envelope and merges the input row', () => {
    const request = build(
      'asana',
      'tasks.create',
      { projects: '55' },
      { accessToken: 't' },
      [{ name: 'Ship it', notes: 'today' }]
    );

    expect(request.method).toBe('POST');
    const body = JSON.parse(request.body!);
    expect(body.data.name).toBe('Ship it');
    expect(body.data.notes).toBe('today');
    // `projects` has to be an array of GIDs.
    expect(body.data.projects).toEqual(['55']);
  });

  it('does not put a path placeholder into an Asana body', () => {
    const request = build('asana', 'tasks.addComment', { taskGid: '9', text: 'done' }, { accessToken: 't' });
    const body = JSON.parse(request.body!);

    expect(request.url).toContain('/tasks/9/stories');
    expect(body.data.text).toBe('done');
    expect(body.data.taskGid).toBeUndefined();
  });

  it('shapes a Sheets values write with a header row', () => {
    const request = build(
      'sheets',
      'values.append',
      { spreadsheetId: 'abc', range: 'Tasks' },
      { accessToken: 'ya29' },
      [{ a: 1, b: 2 }]
    );

    expect(request.url).toContain('/v4/spreadsheets/abc/values/Tasks:append');
    const body = JSON.parse(request.body!);
    expect(body.range).toBe('Tasks');
    expect(body.values).toEqual([
      ['a', 'b'],
      [1, 2],
    ]);
  });

  it('omits the header row when the operation says not to write one', () => {
    const request = build(
      'sheets',
      'values.append',
      { spreadsheetId: 'abc', includeHeaders: false },
      { accessToken: 'ya29' },
      [{ a: 1 }]
    );
    expect(JSON.parse(request.body!).values).toEqual([[1]]);
  });

  it('sends the rows as the body when the operation asks for rows', () => {
    const request = build('supabase', 'functions.invoke', { fn: 'ingest' }, { url: 'https://x.supabase.co', apiKey: 'k' }, [
      { id: 1 },
    ]);

    expect(request.url).toBe('https://x.supabase.co/functions/v1/ingest');
    expect(JSON.parse(request.body!)).toEqual([{ id: 1 }]);
  });

  it('drops the content type when there is no body', () => {
    const request = build('asana', 'workspaces.list', {}, { accessToken: 't' });
    expect(request.headers['Content-Type']).toBeUndefined();
  });

  describe('raw requests', () => {
    it('lets any method and path through, with query and body', () => {
      const request = build(
        'asana',
        'raw.request',
        {
          rawMethod: 'POST',
          rawPath: 'portfolios',
          rawQuery: '{"limit": 5}',
          rawBody: '{"name": "Q4"}',
        },
        { accessToken: 't' }
      );

      expect(request.method).toBe('POST');
      expect(request.url).toContain('/api/1.0/portfolios?limit=5');
      expect(JSON.parse(request.body!)).toEqual({ name: 'Q4' });
    });

    it('falls back to the input rows when no body is typed', () => {
      const request = build(
        'asana',
        'raw.request',
        { rawMethod: 'POST', rawPath: '/x' },
        { accessToken: 't' },
        [{ a: 1 }]
      );
      expect(JSON.parse(request.body!)).toEqual([{ a: 1 }]);
    });

    it('accepts an absolute URL and leaves it alone', () => {
      const request = build('http', 'request.send', { rawPath: 'https://other.test/x' }, { baseUrl: 'https://a.test' });
      expect(request.url).toBe('https://other.test/x');
    });

    it('resolves a relative path against the saved base URL', () => {
      const request = build('http', 'request.send', { rawPath: '/items' }, { baseUrl: 'https://a.test' });
      expect(request.url).toBe('https://a.test/items');
    });

    it('rejects a request with no path, and invalid JSON, by name', () => {
      expect(() => build('asana', 'raw.request', {}, { accessToken: 't' })).toThrow(/a path is required/i);
      expect(() =>
        build('asana', 'raw.request', { rawPath: '/x', rawQuery: 'nope' }, { accessToken: 't' })
      ).toThrow(/Query is not valid JSON/i);
    });
  });
});

describe('Result helpers', () => {
  it('reads a dot path, tolerating gaps', () => {
    expect(readResultPath({ data: [1] }, 'data')).toEqual([1]);
    expect(readResultPath({ a: { b: 2 } }, 'a.b')).toBe(2);
    expect(readResultPath({}, 'a.b')).toBeUndefined();
    expect(readResultPath({ x: 1 }, undefined)).toEqual({ x: 1 });
  });

  it('parses PostgREST filter lines', () => {
    expect(parseFilterLines('status=eq.active\nprice=gt.10')).toEqual([
      ['status', 'eq.active'],
      ['price', 'gt.10'],
    ]);
    // A value containing '=' keeps everything after the first one.
    expect(parseFilterLines('note=eq.a=b')).toEqual([['note', 'eq.a=b']]);
    expect(parseFilterLines('')).toEqual([]);
    expect(parseFilterLines('garbage')).toEqual([]);
  });
});

describe('Sheets values to rows', () => {
  it('uses the first row as the column names', () => {
    expect(
      sheetValuesToRows([
        ['name', 'qty'],
        ['Widget', '3'],
      ])
    ).toEqual([{ name: 'Widget', qty: '3' }]);
  });

  it('pads short rows so every row has every column', () => {
    const rows = sheetValuesToRows([
      ['a', 'b', 'c'],
      ['1'],
    ]);
    expect(rows).toEqual([{ a: '1', b: '', c: '' }]);
  });

  it('gives blank and duplicate headers distinct keys', () => {
    const rows = sheetValuesToRows([
      ['name', '', 'name'],
      ['x', 'y', 'z'],
    ]);
    expect(Object.keys(rows[0])).toEqual(['name', 'col_2', 'name_2']);
  });

  it('emits positional keys when there is no header row', () => {
    expect(sheetValuesToRows([['x', 'y']], false)).toEqual([{ col_1: 'x', col_2: 'y' }]);
  });

  it('returns nothing for an empty or header-only sheet', () => {
    expect(sheetValuesToRows([])).toEqual([]);
    expect(sheetValuesToRows(undefined)).toEqual([]);
    expect(sheetValuesToRows([['a', 'b']])).toEqual([]);
  });
});

describe('Operation catalogue', () => {
  it('gives the named apps a full pull / push / preview surface', () => {
    const sheets = operationsFor('sheets').map((op) => op.id);
    expect(sheets).toContain('values.pull');
    expect(sheets).toContain('values.append');
    expect(sheets).toContain('values.preview');

    const supabase = operationsFor('supabase').map((op) => op.id);
    ['rows.select', 'rows.insert', 'rows.upsert', 'rows.update', 'rows.delete', 'rpc.call'].forEach((id) =>
      expect(supabase).toContain(id)
    );
  });

  it('covers the Asana surface broadly, including a raw escape hatch', () => {
    const asana = operationsFor('asana');
    expect(asana.length).toBeGreaterThanOrEqual(20);

    const ids = asana.map((op) => op.id);
    ['tasks.list', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.search', 'tasks.addComment',
      'projects.list', 'projects.create', 'workspaces.list', 'users.me', 'raw.request'].forEach((id) =>
      expect(ids).toContain(id)
    );
  });

  it('gives every app a raw request, so nothing is unreachable', () => {
    ['asana', 'keepa', 'supabase', 'sheets', 'drive', 'github', 'openrouter', 'huggingface', 'opencode'].forEach(
      (integration) => {
        const ids = operationsFor(integration as any).map((op) => op.id);
        expect(ids, integration).toContain('raw.request');
      }
    );
  });

  it('keeps every spec internally consistent', () => {
    (['asana', 'keepa', 'supabase', 'sheets', 'drive', 'github', 'openrouter', 'huggingface', 'opencode', 'mcp', 'http', 'gemini'] as const).forEach(
      (integration) => {
        operationsFor(integration).forEach((spec) => {
          const where = `${integration}/${spec.id}`;
          expect(spec.label, where).toBeTruthy();
          expect(spec.summary, where).toBeTruthy();

          // Every placeholder must have a field or a config default to fill it.
          const placeholders = Array.from(spec.path.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
          const fieldKeys = (spec.fields || []).map((f) => f.key);
          placeholders.forEach((name) => {
            const backed = fieldKeys.includes(name) || ['workspace', 'range', 'spreadsheetId', 'table', 'owner', 'repo'].includes(name);
            expect(backed, `${where} placeholder {${name}} has no field`).toBe(true);
          });
        });
      }
    );
  });
});
