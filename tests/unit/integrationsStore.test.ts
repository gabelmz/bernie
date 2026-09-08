import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  INTEGRATIONS_CHANGED_EVENT,
  INTEGRATIONS_STORAGE_KEY,
  configFor,
  getIntegration,
  integrationBlocker,
  loadIntegrations,
  saveIntegrations,
} from '@/lib/integrations';

describe('Integration config store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns sensible defaults on a fresh install', () => {
    const config = loadIntegrations();

    expect(config.keepa.domain).toBe(1);
    expect(config.sheets).toMatchObject({ sheetName: 'Sheet1', mode: 'append', includeHeaders: true });
    expect(config.supabase.mode).toBe('insert');
    expect(config.asana.includeCompleted).toBe(false);
  });

  it('merges saved values over the defaults', () => {
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify({ keepa: { apiKey: 'k' } }));

    const config = loadIntegrations();
    expect(config.keepa).toMatchObject({ apiKey: 'k', domain: 1 });
  });

  it('falls back to defaults when stored JSON is corrupt', () => {
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, 'not json at all');
    expect(loadIntegrations().keepa.domain).toBe(1);
  });

  it('round-trips a save and announces the change', () => {
    const listener = vi.fn();
    window.addEventListener(INTEGRATIONS_CHANGED_EVENT, listener);

    const config = loadIntegrations();
    config.supabase = { ...config.supabase, url: 'https://demo.supabase.co', apiKey: 'key', table: 'products' };
    saveIntegrations(config);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getIntegration('supabase')).toMatchObject({ url: 'https://demo.supabase.co', table: 'products' });

    window.removeEventListener(INTEGRATIONS_CHANGED_EVENT, listener);
  });

  it('lets a node override the saved defaults but keeps them for blank fields', () => {
    localStorage.setItem(
      INTEGRATIONS_STORAGE_KEY,
      JSON.stringify({ supabase: { url: 'https://demo.supabase.co', apiKey: 'key', table: 'products' } })
    );

    expect(configFor('supabase', { table: 'orders' })).toMatchObject({ table: 'orders', apiKey: 'key' });
    expect(configFor('supabase', { table: '' })).toMatchObject({ table: 'products' });
  });

  it('describes what is still missing, and nothing once configured', () => {
    expect(integrationBlocker('asana', {})).toMatch(/Missing accessToken/);
    expect(integrationBlocker('supabase', { url: 'https://x.supabase.co' })).toMatch(/Missing apiKey/);
    expect(integrationBlocker('keepa', { apiKey: 'k' })).toBeNull();
  });
});
