import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AsanaNode } from '@/components/nodes/AsanaNode';
import { KeepaNode } from '@/components/nodes/KeepaNode';
import { SupabaseNode } from '@/components/nodes/SupabaseNode';
import { InsightsNode } from '@/components/nodes/InsightsNode';
import { INTEGRATIONS_STORAGE_KEY } from '@/lib/integrations';

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="flow-handle" />,
  NodeToolbar: ({ children }: { children: React.ReactNode }) => <div data-testid="node-toolbar">{children}</div>,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useReactFlow: () => ({ updateNodeData: vi.fn() }),
}));

function mockFetchOnce(payload: any, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => JSON.stringify(payload),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function seedIntegrations(config: Record<string, any>) {
  localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(config));
}

describe('Integration source and sink nodes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('warns on the Asana node until credentials are configured', () => {
    render(<AsanaNode id="asana-1" type="asana" data={{ title: 'Sprint Tasks' }} {...({} as any)} />);

    expect(screen.getByText('Sprint Tasks')).toBeInTheDocument();
    expect(screen.getByText(/Missing accessToken/i)).toBeInTheDocument();
  });

  it('pulls Asana tasks and emits the rows downstream', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '123' } });
    const fetchMock = mockFetchOnce({ rows: [{ gid: '1', name: 'Ship MVP' }], count: 1 });
    const onDataFetched = vi.fn();

    render(
      <AsanaNode id="asana-1" type="asana" data={{ title: 'Asana Tasks', onDataFetched }} {...({} as any)} />
    );

    expect(screen.queryByText(/Missing accessToken/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pull Tasks/i }));

    await waitFor(() => expect(onDataFetched).toHaveBeenCalledWith('asana-1', [{ gid: '1', name: 'Ship MVP' }]));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/asana/tasks');
    expect(JSON.parse(init.body).config).toMatchObject({ accessToken: '1/token', projectGid: '123' });
  });

  it('surfaces the server error message when an Asana pull fails', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '123' } });
    mockFetchOnce({ error: 'Asana: Not Authorized' }, false, 401);
    const onDataFetched = vi.fn();

    render(<AsanaNode id="asana-1" type="asana" data={{ onDataFetched }} {...({} as any)} />);
    fireEvent.click(screen.getByRole('button', { name: /Pull Tasks/i }));

    await waitFor(() => expect(screen.getByText('Asana: Not Authorized')).toBeInTheDocument());
    expect(onDataFetched).toHaveBeenCalledWith('asana-1', { error: 'Asana: Not Authorized' });
  });

  it('sends the ASINs typed on the Keepa node', async () => {
    seedIntegrations({ keepa: { apiKey: 'keepa-key', domain: 1 } });
    const fetchMock = mockFetchOnce({ rows: [{ asin: 'B01', title: 'Widget' }], count: 1 });
    const onDataFetched = vi.fn();

    render(<KeepaNode id="keepa-1" type="keepa" data={{ onDataFetched }} {...({} as any)} />);

    fireEvent.change(screen.getByPlaceholderText(/B08N5WRWNW/i), { target: { value: 'b01, b02' } });
    expect(screen.getByText(/2 ASINs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pull Product Data/i }));

    await waitFor(() => expect(onDataFetched).toHaveBeenCalledWith('keepa-1', [{ asin: 'B01', title: 'Widget' }]));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).asins).toEqual(['B01', 'B02']);
  });

  it('renders the ASINs a Keepa node inherits from the saved config', () => {
    seedIntegrations({ keepa: { apiKey: 'keepa-key', domain: 3, asins: 'B09' } });

    render(<KeepaNode id="keepa-1" type="keepa" data={{}} {...({} as any)} />);

    expect(screen.getByText(/amazon\.de \(DE\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 ASIN/)).toBeInTheDocument();
  });

  it('pushes the incoming rows to Supabase and reports what was written', async () => {
    seedIntegrations({ supabase: { url: 'https://demo.supabase.co', apiKey: 'key', table: 'products' } });
    const fetchMock = mockFetchOnce({ success: true, table: 'products', mode: 'insert', written: 2 });
    const onDataFetched = vi.fn();

    render(
      <SupabaseNode
        id="sb-1"
        type="supabase"
        data={{ inputData: [{ asin: 'A1' }, { asin: 'A2' }], onDataFetched }}
        {...({} as any)}
      />
    );

    expect(screen.getByText(/2 rows ready to write/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Push Rows/i }));

    await waitFor(() => expect(onDataFetched).toHaveBeenCalled());
    expect(onDataFetched.mock.calls[0][1]).toMatchObject({ success: true, written: 2 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).rows).toEqual([{ asin: 'A1' }, { asin: 'A2' }]);
  });

  it('refuses to write to Supabase with no upstream rows, without calling the API', async () => {
    seedIntegrations({ supabase: { url: 'https://demo.supabase.co', apiKey: 'key', table: 'products' } });
    const fetchMock = mockFetchOnce({});
    const onDataFetched = vi.fn();

    render(<SupabaseNode id="sb-1" type="supabase" data={{ onDataFetched }} {...({} as any)} />);
    fireEvent.click(screen.getByRole('button', { name: /Push Rows/i }));

    await waitFor(() => expect(screen.getByText(/No input rows/i)).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the structured insights returned for the incoming rows', async () => {
    mockFetchOnce({
      insights: {
        headline: 'Prices drifted up this week',
        summary: 'Two of three products rose above list price.',
        keyFindings: [{ title: 'Buy box climbing', detail: 'Up 12% week over week.', impact: 'high' }],
        anomalies: [{ title: 'Rank collapse on B03', detail: 'Rank fell out of the top 10k.', severity: 'medium' }],
        recommendations: [{ action: 'Reprice B01', rationale: 'It is now above list price.', priority: 'high' }],
      },
      rowCount: 3,
    });
    const onDataFetched = vi.fn();

    render(
      <InsightsNode
        id="ins-1"
        type="insights"
        data={{ inputData: [{ asin: 'A1' }, { asin: 'A2' }, { asin: 'A3' }], onDataFetched }}
        {...({} as any)}
      />
    );

    expect(screen.getByText(/Analysing 3 rows/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Generate Insights/i }));

    await waitFor(() => expect(onDataFetched).toHaveBeenCalled());
    expect(onDataFetched.mock.calls[0][1].rowCount).toBe(3);
  });

  it('renders insight sections from data already on the node', () => {
    render(
      <InsightsNode
        id="ins-1"
        type="insights"
        data={{
          jsonData: {
            insights: {
              headline: 'Backlog is ageing',
              keyFindings: [{ title: 'Nine tasks past due', impact: 'high' }],
              recommendations: [{ action: 'Triage the overdue list', priority: 'high' }],
            },
          },
        }}
        {...({} as any)}
      />
    );

    expect(screen.getByText('Backlog is ageing')).toBeInTheDocument();
    expect(screen.getByText('Nine tasks past due')).toBeInTheDocument();
    expect(screen.getByText('Triage the overdue list')).toBeInTheDocument();
  });

  it('auto-runs a node when the workflow marks it as running', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '123' } });
    const fetchMock = mockFetchOnce({ rows: [], count: 0 });
    const onDataFetched = vi.fn();

    render(<AsanaNode id="asana-1" type="asana" data={{ status: 'running', onDataFetched }} {...({} as any)} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onDataFetched).toHaveBeenCalledWith('asana-1', []);
  });
});
