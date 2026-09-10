// @vitest-environment node
// The runner reaches @google/genai transitively, which needs web streams that
// jsdom does not provide. This suite is server code anyway.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runOperation } from '@/server/operationRunner';

/** A minimal stand-in for the parts of Response the runner touches. */
function jsonResponse(body: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('Asana bulk task creation', () => {
  const config = { accessToken: 'pat-123' };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockCreated() {
    (fetch as any).mockImplementation(async (_url: string, init: RequestInit) => {
      const sent = JSON.parse(String(init.body)).data;
      return jsonResponse({ data: { gid: `gid-${sent.name}`, name: sent.name, notes: sent.notes } });
    });
  }

  it('sends one request per row rather than only the first', async () => {
    mockCreated();

    const result = await runOperation({
      integration: 'asana',
      operationId: 'tasks.create',
      config,
      params: { projects: '1200' },
      rows: [{ name: 'Fix A' }, { name: 'Fix B' }, { name: 'Fix C' }],
    });

    expect((fetch as any).mock.calls).toHaveLength(3);
    expect(result.rows).toHaveLength(3);
    expect(result.meta?.created).toBe(3);
  });

  it('applies the node-level project to every row', async () => {
    mockCreated();

    await runOperation({
      integration: 'asana',
      operationId: 'tasks.create',
      config,
      params: { projects: '1200' },
      rows: [{ name: 'Fix A' }, { name: 'Fix B' }],
    });

    const bodies = (fetch as any).mock.calls.map((call: any[]) => JSON.parse(call[1].body).data);
    expect(bodies.every((body: any) => body.projects[0] === '1200')).toBe(true);
    expect(bodies.map((body: any) => body.name)).toEqual(['Fix A', 'Fix B']);
  });

  it('lets a row override the node-level project', async () => {
    mockCreated();

    await runOperation({
      integration: 'asana',
      operationId: 'tasks.create',
      config,
      params: { projects: '1200' },
      rows: [{ name: 'Fix A', projects: '9999' }],
    });

    const body = JSON.parse((fetch as any).mock.calls[0][1].body).data;
    expect(body.projects).toEqual(['9999']);
  });

  it('refuses a row with no name instead of creating a blank task', async () => {
    mockCreated();

    await expect(
      runOperation({
        integration: 'asana',
        operationId: 'tasks.create',
        config,
        params: { projects: '1200' },
        rows: [{ notes: 'orphan' }],
      })
    ).rejects.toThrow(/needs a name/);
  });

  it('requires a project or workspace before making any request', async () => {
    mockCreated();

    await expect(
      runOperation({
        integration: 'asana',
        operationId: 'tasks.create',
        config,
        params: {},
        rows: [{ name: 'Fix A' }],
      })
    ).rejects.toThrow(/project or workspace/);
    expect((fetch as any).mock.calls).toHaveLength(0);
  });
});

describe('Keepa lookup merged with its input rows', () => {
  const config = { apiKey: 'keepa-key' };

  const products = [
    { asin: 'B001', title: 'Widget', monthlySold: 420, stats: { current: [2599] } },
    { asin: 'B002', title: 'Gadget', monthlySold: 12, stats: { current: [999] } },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ products, tokensLeft: 88 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const issueRows = [
    { asin: 'B001', issue: 'Missing A+ content', owner: 'ops' },
    { asin: 'B002', issue: 'Suppressed listing', owner: 'ops' },
  ];

  it('keeps the upstream columns alongside the product fields', async () => {
    const result = await runOperation({
      integration: 'keepa',
      operationId: 'product.lookup',
      config,
      params: { mergeInputRows: true },
      rows: issueRows,
    });

    expect(result.rows[0]).toMatchObject({
      asin: 'B001',
      issue: 'Missing A+ content',
      owner: 'ops',
      title: 'Widget',
      monthly_sold: 420,
    });
  });

  it('replaces the rows entirely when merging is off', async () => {
    const result = await runOperation({
      integration: 'keepa',
      operationId: 'product.lookup',
      config,
      params: {},
      rows: issueRows,
    });

    expect(result.rows[0].issue).toBeUndefined();
    expect(result.rows[0].asin).toBe('B001');
  });

  it('keeps a row Keepa returned nothing for, without inventing fields', async () => {
    const result = await runOperation({
      integration: 'keepa',
      operationId: 'product.lookup',
      config,
      params: { mergeInputRows: true },
      rows: [...issueRows, { asin: 'B999', issue: 'Unknown ASIN' }],
    });

    expect(result.rows).toHaveLength(3);
    expect(result.rows[2]).toEqual({ asin: 'B999', issue: 'Unknown ASIN' });
  });

  it('batches past Keepa’s 100-ASIN limit instead of dropping the rest', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ asin: `B${String(i).padStart(4, '0')}` }));

    (fetch as any).mockImplementation(async (url: string) => {
      const asins = new URL(String(url)).searchParams.get('asin')!.split(',');
      return jsonResponse({
        products: asins.map((asin) => ({ asin, title: `T-${asin}` })),
        tokensLeft: 5,
      });
    });

    const result = await runOperation({
      integration: 'keepa',
      operationId: 'product.lookup',
      config,
      params: {},
      rows: many,
    });

    expect((fetch as any).mock.calls).toHaveLength(3);
    expect(result.rows).toHaveLength(250);
    expect(result.meta?.batches).toBe(3);

    const sizes = (fetch as any).mock.calls.map(
      (call: any[]) => new URL(String(call[0])).searchParams.get('asin')!.split(',').length
    );
    expect(sizes).toEqual([100, 100, 50]);
  });

  it('looks up the ASINs carried on the input rows', async () => {
    await runOperation({
      integration: 'keepa',
      operationId: 'product.lookup',
      config,
      params: { mergeInputRows: true },
      rows: issueRows,
    });

    expect(String((fetch as any).mock.calls[0][0])).toContain('asin=B001%2CB002');
  });
});
