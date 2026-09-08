import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INTEGRATION_CONFIG,
  INTEGRATION_CATEGORIES,
  INTEGRATION_IDS,
  INTEGRATION_SCHEMAS,
  IntegrationId,
  applyHttpDefaults,
  integrationsInCategory,
  parseHeaders,
  validateIntegrationConfig,
} from '@/lib/integrationCore';

const EXPECTED_IDS: IntegrationId[] = [
  'asana',
  'keepa',
  'drive',
  'supabase',
  'sheets',
  'gemini',
  'openrouter',
  'huggingface',
  'opencode',
  'github',
  'http',
  'mcp',
];

describe('Integration registry', () => {
  it('exposes every connection the Connections page offers', () => {
    expect(INTEGRATION_IDS).toEqual(EXPECTED_IDS);
  });

  it('gives every integration a schema, defaults and a category', () => {
    INTEGRATION_IDS.forEach((id) => {
      const schema = INTEGRATION_SCHEMAS[id];
      expect(schema, id).toBeDefined();
      expect(schema.id).toBe(id);
      expect(schema.name.length).toBeGreaterThan(0);
      expect(schema.description.length).toBeGreaterThan(0);
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(INTEGRATION_CATEGORIES.map((c) => c.id)).toContain(schema.category);
      expect(DEFAULT_INTEGRATION_CONFIG[id], id).toBeDefined();
    });
  });

  it('declares each required key as a real field on that integration', () => {
    INTEGRATION_IDS.forEach((id) => {
      const schema = INTEGRATION_SCHEMAS[id];
      const fieldKeys = schema.fields.map((f) => f.key);
      schema.requiredKeys.forEach((key) => {
        expect(fieldKeys, `${id}.${key}`).toContain(key);
      });
    });
  });

  it('assigns every integration to exactly one category group', () => {
    const grouped = INTEGRATION_CATEGORIES.flatMap((category) => integrationsInCategory(category.id));

    expect(grouped.slice().sort()).toEqual(INTEGRATION_IDS.slice().sort());
    expect(new Set(grouped).size).toBe(INTEGRATION_IDS.length);
  });

  it('groups the new providers where the UI expects them', () => {
    expect(integrationsInCategory('sources')).toContain('drive');
    expect(integrationsInCategory('ai')).toEqual(['gemini', 'openrouter', 'huggingface']);
    expect(integrationsInCategory('developer')).toEqual(['opencode', 'github', 'http', 'mcp']);
  });

  it('marks MCP as untestable so the UI hides its Test button', () => {
    expect(INTEGRATION_SCHEMAS.mcp.testable).toBe(false);
    INTEGRATION_IDS.filter((id) => id !== 'mcp').forEach((id) => {
      expect(INTEGRATION_SCHEMAS[id].testable, id).toBe(true);
    });
  });

  it('validates the new providers against their own required keys', () => {
    expect(validateIntegrationConfig('gemini', {})).toEqual({ valid: false, missing: ['apiKey'] });
    expect(validateIntegrationConfig('openrouter', { apiKey: 'sk-or-v1-x' }).valid).toBe(true);
    expect(validateIntegrationConfig('huggingface', {})).toEqual({ valid: false, missing: ['token'] });
    expect(validateIntegrationConfig('github', { token: 'ghp_x' }).valid).toBe(true);
    expect(validateIntegrationConfig('opencode', {})).toEqual({ valid: false, missing: ['baseUrl'] });
    expect(validateIntegrationConfig('http', { baseUrl: 'https://api.example.com' }).valid).toBe(true);
    expect(validateIntegrationConfig('mcp', {})).toEqual({ valid: false, missing: ['serverUrl'] });
  });

  it('treats Drive as always valid because it rides on the Google account', () => {
    expect(INTEGRATION_SCHEMAS.drive.requiresGoogleAuth).toBe(true);
    expect(validateIntegrationConfig('drive', {})).toEqual({ valid: true, missing: [] });
  });

  it('ships usable defaults for the providers that have a canonical endpoint', () => {
    expect(DEFAULT_INTEGRATION_CONFIG.openrouter.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(DEFAULT_INTEGRATION_CONFIG.github.apiBaseUrl).toBe('https://api.github.com');
    expect(DEFAULT_INTEGRATION_CONFIG.opencode.baseUrl).toBe('http://localhost:4096');
    expect(DEFAULT_INTEGRATION_CONFIG.gemini.model).toBeTruthy();
  });
});

describe('Custom HTTP saves', () => {
  it('parses headers from an object or a JSON string, and shrugs off junk', () => {
    expect(parseHeaders({ A: '1', B: 2 })).toEqual({ A: '1', B: '2' });
    expect(parseHeaders('{"X-Api-Version":"2024-01"}')).toEqual({ 'X-Api-Version': '2024-01' });
    expect(parseHeaders('not json')).toEqual({});
    expect(parseHeaders(undefined)).toEqual({});
    // A JSON array is not a header map, so it is discarded rather than
    // turned into numeric header names.
    expect(parseHeaders('[1,2]')).toEqual({});
    expect(parseHeaders([1, 2])).toEqual({});
  });

  it('resolves a relative node URL against the saved base URL', () => {
    const resolved = applyHttpDefaults({ baseUrl: 'https://api.example.com/' }, { url: '/v1/items' });
    expect(resolved.url).toBe('https://api.example.com/v1/items');
  });

  it('leaves an absolute node URL alone', () => {
    const resolved = applyHttpDefaults({ baseUrl: 'https://api.example.com' }, { url: 'https://other.test/x' });
    expect(resolved.url).toBe('https://other.test/x');
  });

  it('falls back to the base URL when the node has no URL of its own', () => {
    expect(applyHttpDefaults({ baseUrl: 'https://api.example.com' }, {}).url).toBe('https://api.example.com');
  });

  it('passes the node URL through untouched when nothing is saved', () => {
    expect(applyHttpDefaults(undefined, { url: '/v1/items' }).url).toBe('/v1/items');
    expect(applyHttpDefaults({}, { url: 'https://a.test' }).url).toBe('https://a.test');
  });

  it('merges the saved headers underneath the node headers', () => {
    const resolved = applyHttpDefaults(
      { baseUrl: 'https://api.example.com', authHeader: 'Bearer saved', headers: '{"X-Env":"prod","X-Trace":"1"}' },
      { url: '/x', headers: { 'X-Env': 'staging' } }
    );

    expect(resolved.headers).toEqual({
      Authorization: 'Bearer saved',
      'X-Env': 'staging',
      'X-Trace': '1',
    });
  });

  it('lets a node override the saved Authorization header', () => {
    const resolved = applyHttpDefaults(
      { authHeader: 'Bearer saved' },
      { url: 'https://a.test', headers: { Authorization: 'Bearer node' } }
    );
    expect(resolved.headers.Authorization).toBe('Bearer node');
  });

  it('only reports a positive timeout', () => {
    expect(applyHttpDefaults({ timeoutMs: 5000 }, {}).timeoutMs).toBe(5000);
    expect(applyHttpDefaults({ timeoutMs: 0 }, {}).timeoutMs).toBeUndefined();
    expect(applyHttpDefaults({}, {}).timeoutMs).toBeUndefined();
  });
});
