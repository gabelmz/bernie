import { describe, it, expect } from 'vitest';
import {
  buildAsanaTasksUrl,
  buildKeepaProductUrl,
  buildSheetValues,
  buildSheetsRequest,
  buildSupabaseRequest,
  collectRowHeaders,
  decodeKeepaInt,
  decodeKeepaPrice,
  decodeKeepaRating,
  keepaMinutesToIso,
  lastKeepaCsvValue,
  normalizeAsanaTasks,
  normalizeKeepaProducts,
  parseAsinList,
  resolveConfig,
  summarizeRows,
  toRows,
  validateIntegrationConfig,
} from '@/lib/integrationCore';

describe('Integration config validation', () => {
  it('reports the missing required keys per integration', () => {
    expect(validateIntegrationConfig('asana', {})).toEqual({ valid: false, missing: ['accessToken'] });
    expect(validateIntegrationConfig('keepa', {})).toEqual({ valid: false, missing: ['apiKey'] });
    expect(validateIntegrationConfig('supabase', { url: 'https://x.supabase.co' })).toEqual({
      valid: false,
      missing: ['apiKey'],
    });
    expect(validateIntegrationConfig('sheets', { spreadsheetId: 'abc' })).toEqual({ valid: true, missing: [] });
  });

  it('treats whitespace-only credentials as missing', () => {
    expect(validateIntegrationConfig('asana', { accessToken: '   ' }).valid).toBe(false);
    expect(validateIntegrationConfig('asana', { accessToken: '1/abc' }).valid).toBe(true);
  });

  it('lets node overrides win but never clobbers defaults with blanks', () => {
    const base = { table: 'products', mode: 'insert' as const, apiKey: 'key' };

    expect(resolveConfig(base, { table: 'orders' })).toEqual({ table: 'orders', mode: 'insert', apiKey: 'key' });
    expect(resolveConfig(base, { table: '' })).toEqual(base);
    expect(resolveConfig(base, { table: undefined })).toEqual(base);
  });
});

describe('Row normalization', () => {
  it('passes arrays of objects through untouched', () => {
    const rows = [{ a: 1 }, { a: 2 }];
    expect(toRows(rows)).toEqual(rows);
  });

  it('unwraps the envelopes source nodes emit', () => {
    expect(toRows({ rows: [{ gid: '1' }] })).toEqual([{ gid: '1' }]);
    expect(toRows({ products: [{ asin: 'A' }] })).toEqual([{ asin: 'A' }]);
    expect(toRows({ data: [{ x: 1 }] })).toEqual([{ x: 1 }]);
  });

  it('wraps scalars and single objects into one row', () => {
    expect(toRows('hello')).toEqual([{ value: 'hello' }]);
    expect(toRows(42)).toEqual([{ value: 42 }]);
    expect(toRows({ name: 'solo' })).toEqual([{ name: 'solo' }]);
    expect(toRows([1, 2])).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('returns no rows for empty payloads', () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
    expect(toRows([])).toEqual([]);
  });

  it('collects the union of keys across ragged rows in first-seen order', () => {
    expect(collectRowHeaders([{ a: 1 }, { b: 2 }, { a: 3, c: 4 }])).toEqual(['a', 'b', 'c']);
  });
});

describe('Google Sheets payloads', () => {
  it('builds a header row followed by aligned value rows', () => {
    const values = buildSheetValues([
      { asin: 'A1', price: 10 },
      { asin: 'A2', price: 20 },
    ]);

    expect(values).toEqual([
      ['asin', 'price'],
      ['A1', 10],
      ['A2', 20],
    ]);
  });

  it('omits the header row when asked', () => {
    expect(buildSheetValues([{ asin: 'A1' }], false)).toEqual([['A1']]);
  });

  it('fills blanks for missing keys and stringifies nested values', () => {
    const values = buildSheetValues([{ a: 1 }, { b: { nested: true } }]);

    expect(values).toEqual([
      ['a', 'b'],
      [1, ''],
      ['', '{"nested":true}'],
    ]);
  });

  it('handles empty input without producing a stray header', () => {
    expect(buildSheetValues([])).toEqual([]);
  });

  it('appends by default and overwrites when the mode says so', () => {
    const append = buildSheetsRequest({ spreadsheetId: 'sheet-1', sheetName: 'Tasks' }, [['a']]);
    expect(append.method).toBe('POST');
    expect(append.url).toContain('/values/Tasks!A1:append');
    expect(append.url).toContain('valueInputOption=USER_ENTERED');
    expect(append.body.range).toBe('Tasks!A1');

    const overwrite = buildSheetsRequest({ spreadsheetId: 'sheet-1', sheetName: 'Tasks', mode: 'overwrite' }, [['a']]);
    expect(overwrite.method).toBe('PUT');
    expect(overwrite.url).not.toContain(':append');
  });

  it('defaults the tab to Sheet1 and requires a spreadsheet id', () => {
    expect(buildSheetsRequest({ spreadsheetId: 'sheet-1' }, [['a']]).body.range).toBe('Sheet1!A1');
    expect(() => buildSheetsRequest({}, [['a']])).toThrow(/spreadsheet ID is required/i);
  });
});

describe('Supabase payloads', () => {
  const config = { url: 'https://demo.supabase.co', apiKey: 'service-key', table: 'products' };

  it('builds an insert against the REST endpoint', () => {
    const request = buildSupabaseRequest(config, [{ asin: 'A1' }]);

    expect(request.url).toBe('https://demo.supabase.co/rest/v1/products');
    expect(request.headers.apikey).toBe('service-key');
    expect(request.headers.Authorization).toBe('Bearer service-key');
    expect(request.headers.Prefer).toBe('return=representation');
    expect(request.body).toEqual([{ asin: 'A1' }]);
  });

  it('adds merge-duplicates and on_conflict for upserts', () => {
    const request = buildSupabaseRequest({ ...config, mode: 'upsert', onConflict: 'asin' }, [{ asin: 'A1' }]);

    expect(request.url).toBe('https://demo.supabase.co/rest/v1/products?on_conflict=asin');
    expect(request.headers.Prefer).toContain('resolution=merge-duplicates');
  });

  it('tolerates a trailing slash on the project URL', () => {
    const request = buildSupabaseRequest({ ...config, url: 'https://demo.supabase.co/' }, [{ asin: 'A1' }]);
    expect(request.url).toBe('https://demo.supabase.co/rest/v1/products');
  });

  it('refuses incomplete configs and empty writes', () => {
    expect(() => buildSupabaseRequest({ ...config, url: '' }, [{ a: 1 }])).toThrow(/project URL is required/i);
    expect(() => buildSupabaseRequest({ ...config, apiKey: '' }, [{ a: 1 }])).toThrow(/API key is required/i);
    expect(() => buildSupabaseRequest({ ...config, table: '' }, [{ a: 1 }])).toThrow(/target table is required/i);
    expect(() => buildSupabaseRequest(config, [])).toThrow(/no rows to write/i);
  });
});

describe('Asana task pulls', () => {
  it('scopes the query by project', () => {
    const url = buildAsanaTasksUrl({ accessToken: 't', projectGid: '123' });
    const params = new URL(url).searchParams;

    expect(url.startsWith('https://app.asana.com/api/1.0/tasks?')).toBe(true);
    expect(params.get('project')).toBe('123');
    expect(params.get('completed_since')).toBe('now');
    expect(params.get('opt_fields')).toContain('assignee.name');
  });

  it('falls back to assignee plus workspace when no project is set', () => {
    const params = new URL(buildAsanaTasksUrl({ accessToken: 't', assigneeGid: 'me', workspaceGid: '999' })).searchParams;

    expect(params.get('assignee')).toBe('me');
    expect(params.get('workspace')).toBe('999');
    expect(params.get('project')).toBeNull();
  });

  it('drops the completed filter when completed tasks are wanted', () => {
    const params = new URL(buildAsanaTasksUrl({ accessToken: 't', projectGid: '1', includeCompleted: true })).searchParams;
    expect(params.get('completed_since')).toBeNull();
  });

  it('caps the page size at the Asana maximum', () => {
    const params = new URL(buildAsanaTasksUrl({ accessToken: 't', projectGid: '1', limit: 5000 })).searchParams;
    expect(params.get('limit')).toBe('100');
  });

  it('explains itself when the scope is ambiguous', () => {
    expect(() => buildAsanaTasksUrl({ accessToken: 't' })).toThrow(/project GID/i);
    expect(() => buildAsanaTasksUrl({ accessToken: 't', assigneeGid: 'me' })).toThrow(/workspace GID/i);
  });

  it('flattens nested task fields into rows', () => {
    const rows = normalizeAsanaTasks([
      {
        gid: '1',
        name: 'Ship MVP',
        completed: false,
        due_on: '2026-09-30',
        assignee: { gid: 'u1', name: 'Gabe' },
        projects: [{ gid: 'p1', name: 'Bernie' }, { gid: 'p2', name: 'Ops' }],
        tags: [{ name: 'urgent' }],
        custom_fields: [{ name: 'Story Points', display_value: '5' }],
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gid: '1',
      name: 'Ship MVP',
      completed: false,
      due_on: '2026-09-30',
      assignee: 'Gabe',
      assignee_gid: 'u1',
      projects: 'Bernie, Ops',
      tags: 'urgent',
      cf_story_points: '5',
    });
  });

  it('normalizes sparse tasks without throwing', () => {
    const rows = normalizeAsanaTasks([{ gid: '2' }]);

    expect(rows[0].assignee).toBeNull();
    expect(rows[0].completed).toBe(false);
    expect(rows[0].num_subtasks).toBe(0);
    expect(normalizeAsanaTasks(undefined as any)).toEqual([]);
  });
});

describe('Keepa product pulls', () => {
  it('parses ASIN lists from mixed separators', () => {
    expect(parseAsinList('b08n5wrwnw, B07FZ8S74R\nB000123')).toEqual(['B08N5WRWNW', 'B07FZ8S74R', 'B000123']);
    expect(parseAsinList(['a1', ' a2 '])).toEqual(['A1', 'A2']);
    expect(parseAsinList('')).toEqual([]);
    expect(parseAsinList(null)).toEqual([]);
  });

  it('builds the product URL with key, domain and stats window', () => {
    const params = new URL(buildKeepaProductUrl({ apiKey: 'k', domain: 3, statsDays: 90 }, ['A1', 'A2'])).searchParams;

    expect(params.get('key')).toBe('k');
    expect(params.get('domain')).toBe('3');
    expect(params.get('asin')).toBe('A1,A2');
    expect(params.get('stats')).toBe('90');
  });

  it('defaults to the US marketplace and caps the batch at 100 ASINs', () => {
    const asins = Array.from({ length: 150 }, (_, i) => `A${i}`);
    const params = new URL(buildKeepaProductUrl({ apiKey: 'k' }, asins)).searchParams;

    expect(params.get('domain')).toBe('1');
    expect(params.get('asin')!.split(',')).toHaveLength(100);
  });

  it('requires a key and at least one ASIN', () => {
    expect(() => buildKeepaProductUrl({}, ['A1'])).toThrow(/API key is required/i);
    expect(() => buildKeepaProductUrl({ apiKey: 'k' }, [])).toThrow(/at least one ASIN/i);
  });

  it('decodes prices, ratings and the -1 no-data sentinel', () => {
    expect(decodeKeepaPrice(1999)).toBe(19.99);
    expect(decodeKeepaPrice(-1)).toBeNull();
    expect(decodeKeepaRating(45)).toBe(4.5);
    expect(decodeKeepaRating(-1)).toBeNull();
    expect(decodeKeepaInt(1234)).toBe(1234);

    // Missing values must stay null: a coerced 0 would land in Supabase as a
    // real price of 0.00.
    [null, undefined, ''].forEach((blank) => {
      expect(decodeKeepaPrice(blank)).toBeNull();
      expect(decodeKeepaInt(blank)).toBeNull();
      expect(decodeKeepaRating(blank)).toBeNull();
    });
  });

  it('converts Keepa minutes to an ISO timestamp', () => {
    expect(keepaMinutesToIso(0)).toBeNull();
    expect(keepaMinutesToIso(21564000 * 0 + 1)).toBe(new Date((1 + 21564000) * 60000).toISOString());
  });

  it('reads the newest value out of a csv history track', () => {
    const csv = [[100, 1999, 200, 2499]];
    expect(lastKeepaCsvValue(csv, 0)).toBe(2499);
    expect(lastKeepaCsvValue(csv, 3)).toBeNull();
    expect(lastKeepaCsvValue(null, 0)).toBeNull();
  });

  it('prefers stats.current over csv history when both are present', () => {
    const rows = normalizeKeepaProducts([
      {
        asin: 'B01',
        title: 'Widget',
        brand: 'Acme',
        // csv holds an older price than stats.current
        csv: [[100, 1000]],
        stats: { current: [2599, 2699, -1, 1234, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 45, 812, 2549] },
      },
    ]);

    expect(rows[0]).toMatchObject({
      asin: 'B01',
      title: 'Widget',
      brand: 'Acme',
      amazon_price: 25.99,
      new_price: 26.99,
      used_price: null,
      sales_rank: 1234,
      rating: 4.5,
      review_count: 812,
      buy_box_price: 25.49,
    });
  });

  it('falls back to csv history when stats are absent', () => {
    const rows = normalizeKeepaProducts([{ asin: 'B02', csv: [[10, 1500]] }]);
    expect(rows[0].amazon_price).toBe(15);
    expect(normalizeKeepaProducts(undefined as any)).toEqual([]);
  });
});

describe('Row summaries for AI insights', () => {
  it('summarizes shape and numeric ranges, ignoring non-numeric fields', () => {
    const summary = summarizeRows([
      { asin: 'A1', price: 10, rank: 100 },
      { asin: 'A2', price: 20, rank: 300 },
    ]);

    expect(summary.rowCount).toBe(2);
    expect(summary.fields).toEqual(['asin', 'price', 'rank']);
    expect(summary.numericSummary.price).toEqual({ min: 10, max: 20, mean: 15, count: 2 });
    expect(summary.numericSummary.asin).toBeUndefined();
  });

  it('handles an empty row set', () => {
    expect(summarizeRows([])).toEqual({ rowCount: 0, fields: [], numericSummary: {} });
  });
});
