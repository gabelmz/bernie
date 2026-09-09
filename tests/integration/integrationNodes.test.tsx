import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AsanaAppNode, SheetsAppNode, SupabaseAppNode } from '@/components/nodes/appNodes';
import { InsightsNode } from '@/components/nodes/InsightsNode';
import { INTEGRATIONS_STORAGE_KEY } from '@/lib/integrations';

const updateNodeData = vi.fn();

vi.mock('@xyflow/react', () => ({
  Handle: () => <div data-testid="flow-handle" />,
  NodeToolbar: ({ children }: { children: React.ReactNode }) => <div data-testid="node-toolbar">{children}</div>,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useReactFlow: () => ({ updateNodeData }),
}));

// The Google token comes from Supabase sign-in, which these tests stub out.
vi.mock('@/lib/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('ya29.test-token'),
  hasGoogleAccess: () => true,
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

/** The body of the single execute call a node makes. */
function executeBody(fetchMock: any) {
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/integrations/execute');
  return JSON.parse(init.body);
}

describe('App-scoped nodes', () => {
  beforeEach(() => {
    localStorage.clear();
    updateNodeData.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('offers every operation the app supports, not just one', () => {
    seedIntegrations({ asana: { accessToken: '1/token' } });

    render(<AsanaAppNode id="a1" type="asana" data={{ title: 'Asana' }} {...({} as any)} />);

    const picker = screen.getByRole('combobox');
    const labels = Array.from(picker.querySelectorAll('option')).map((o) => o.textContent);

    // Pull, push and mutate all live in the same node.
    expect(labels).toContain('List tasks');
    expect(labels).toContain('Create tasks');
    expect(labels).toContain('Add comment');
    expect(labels).toContain('List projects');
    expect(labels).toContain('Raw API request');
  });

  it('defaults to the app default operation and describes it', () => {
    seedIntegrations({ asana: { accessToken: '1/token' } });

    render(<AsanaAppNode id="a1" type="asana" data={{}} {...({} as any)} />);

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('tasks.list');
    expect(screen.getByText(/Tasks in a project/i)).toBeInTheDocument();
  });

  it('records the chosen operation on the node', () => {
    seedIntegrations({ asana: { accessToken: '1/token' } });

    render(<AsanaAppNode id="a1" type="asana" data={{}} {...({} as any)} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'projects.list' } });

    expect(updateNodeData).toHaveBeenCalledWith('a1', { operation: 'projects.list' });
  });

  it('sends the integration, operation and params to the one execute route', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '999' } });
    const fetchMock = mockFetchOnce({ rows: [{ gid: '1', name: 'Ship it' }], count: 1 });
    const onDataFetched = vi.fn();

    render(
      <AsanaAppNode
        id="a1"
        type="asana"
        data={{ operation: 'tasks.list', params: { limit: 25 }, onDataFetched }}
        {...({} as any)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /List tasks/i }));
    await waitFor(() => expect(onDataFetched).toHaveBeenCalledWith('a1', [{ gid: '1', name: 'Ship it' }]));

    const body = executeBody(fetchMock);
    expect(body.integration).toBe('asana');
    expect(body.operation).toBe('tasks.list');
    expect(body.params.limit).toBe(25);
    expect(body.config.accessToken).toBe('1/token');
  });

  it('prefers a key dropped on the node over the saved connection', async () => {
    seedIntegrations({ asana: { accessToken: 'saved-token' } });
    const fetchMock = mockFetchOnce({ rows: [], count: 0 });

    render(
      <AsanaAppNode
        id="a1"
        type="asana"
        data={{ operation: 'tasks.list', params: { project: '1' }, credentials: { accessToken: 'node-token' } }}
        {...({} as any)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /List tasks/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(executeBody(fetchMock).config.accessToken).toBe('node-token');
  });

  it('runs on a node-only key with nothing saved globally', async () => {
    const fetchMock = mockFetchOnce({ rows: [], count: 0 });

    render(
      <AsanaAppNode
        id="a1"
        type="asana"
        data={{ operation: 'tasks.list', params: { project: '1' }, credentials: { accessToken: 'only-here' } }}
        {...({} as any)}
      />
    );

    // No credential warning, because the node supplies its own.
    expect(screen.queryByText(/Needs accessToken/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /List tasks/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(executeBody(fetchMock).config.accessToken).toBe('only-here');
  });

  it('says which key is missing, and where it can go', () => {
    render(<AsanaAppNode id="a1" type="asana" data={{}} {...({} as any)} />);

    expect(screen.getByText(/Needs accessToken/i)).toBeInTheDocument();
    expect(screen.getByText(/Edit pane/i)).toBeInTheDocument();
  });

  it('renders pulled rows as a preview table', async () => {
    seedIntegrations({ supabase: { url: 'https://demo.supabase.co', apiKey: 'k', table: 'products' } });

    render(
      <SupabaseAppNode
        id="s1"
        type="supabase"
        data={{
          operation: 'rows.select',
          jsonData: [
            { asin: 'A1', price: 10 },
            { asin: 'A2', price: 20 },
          ],
        }}
        {...({} as any)}
      />
    );

    expect(screen.getByText('2 rows')).toBeInTheDocument();
    expect(screen.getByText('asin')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('reports whether a push has rows waiting on its input', () => {
    seedIntegrations({ supabase: { url: 'https://demo.supabase.co', apiKey: 'k', table: 'products' } });

    const { rerender } = render(
      <SupabaseAppNode id="s1" type="supabase" data={{ operation: 'rows.insert' }} {...({} as any)} />
    );
    expect(screen.getByText(/Waiting for input rows/i)).toBeInTheDocument();

    rerender(
      <SupabaseAppNode
        id="s1"
        type="supabase"
        data={{ operation: 'rows.insert', inputData: [{ a: 1 }, { a: 2 }] }}
        {...({} as any)}
      />
    );
    expect(screen.getByText(/2 input rows ready/i)).toBeInTheDocument();
  });

  it('passes the Google token for Sheets, which has no key of its own', async () => {
    seedIntegrations({ sheets: { spreadsheetId: 'sheet-1' } });
    const fetchMock = mockFetchOnce({ rows: [{ a: '1' }], count: 1 });

    render(<SheetsAppNode id="g1" type="sheet" data={{ operation: 'values.pull' }} {...({} as any)} />);

    fireEvent.click(screen.getByRole('button', { name: /Pull data/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(executeBody(fetchMock).accessToken).toBe('ya29.test-token');
  });

  it('surfaces the server error message on the node', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '1' } });
    mockFetchOnce({ error: 'Asana: Not Authorized' }, false, 401);
    const onDataFetched = vi.fn();

    render(
      <AsanaAppNode id="a1" type="asana" data={{ operation: 'tasks.list', onDataFetched }} {...({} as any)} />
    );

    fireEvent.click(screen.getByRole('button', { name: /List tasks/i }));
    await waitFor(() => expect(screen.getByText('Asana: Not Authorized')).toBeInTheDocument());
    expect(onDataFetched).toHaveBeenCalledWith('a1', { error: 'Asana: Not Authorized' });
  });

  it('auto-runs when the workflow marks the node running', async () => {
    seedIntegrations({ asana: { accessToken: '1/token', projectGid: '1' } });
    const fetchMock = mockFetchOnce({ rows: [], count: 0 });

    render(
      <AsanaAppNode id="a1" type="asana" data={{ operation: 'tasks.list', status: 'running' }} {...({} as any)} />
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('still runs a node saved before app-scoped operations existed', async () => {
    seedIntegrations({ sheets: {} });
    const fetchMock = mockFetchOnce({ rows: [], count: 0 });

    // The old Sheets node stored these as flat fields, with no operation id.
    render(
      <SheetsAppNode
        id="g1"
        type="sheet"
        data={{ spreadsheetId: 'legacy-sheet', sheetName: 'Tasks', mode: 'append' }}
        {...({} as any)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Push data/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = executeBody(fetchMock);
    expect(body.operation).toBe('values.append');
    expect(body.params.spreadsheetId).toBe('legacy-sheet');
    expect(body.params.range).toBe('Tasks');
  });
});

describe('Insights node', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the structured sections it is given', () => {
    render(
      <InsightsNode
        id="i1"
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
});
