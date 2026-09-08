/**
 * Browser-side store for integration credentials and defaults. Configs live in
 * localStorage under a single key so the Integrations page and every node read
 * the same values.
 */

import {
  DEFAULT_INTEGRATION_CONFIG,
  INTEGRATION_IDS,
  IntegrationConfigMap,
  IntegrationId,
  resolveConfig,
  validateIntegrationConfig,
} from './integrationCore';

export const INTEGRATIONS_STORAGE_KEY = 'bernie-integrations';

/** Fired after a save so open nodes pick up new credentials without a reload. */
export const INTEGRATIONS_CHANGED_EVENT = 'bernie:integrations-changed';

function cloneDefaults(): IntegrationConfigMap {
  return JSON.parse(JSON.stringify(DEFAULT_INTEGRATION_CONFIG)) as IntegrationConfigMap;
}

export function loadIntegrations(): IntegrationConfigMap {
  const config = cloneDefaults();

  try {
    const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
    if (!raw) return config;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return config;

    INTEGRATION_IDS.forEach((id) => {
      const saved = parsed[id];
      if (saved && typeof saved === 'object') {
        config[id] = { ...config[id], ...saved };
      }
    });
  } catch {
    // Corrupt or unavailable storage falls back to defaults.
  }

  return config;
}

export function saveIntegrations(config: IntegrationConfigMap): void {
  try {
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(INTEGRATIONS_CHANGED_EVENT, { detail: config }));
  } catch (err) {
    console.error('Failed to persist integration config', err);
  }
}

/** Reads one integration's saved config. */
export function getIntegration<K extends IntegrationId>(id: K): IntegrationConfigMap[K] {
  return loadIntegrations()[id];
}

/**
 * Merges the saved config for an integration with a node's own overrides.
 * Node-level values win, blank node values fall through to the saved config.
 */
export function configFor<K extends IntegrationId>(
  id: K,
  overrides?: Partial<IntegrationConfigMap[K]>
): IntegrationConfigMap[K] {
  return resolveConfig(getIntegration(id), overrides);
}

/**
 * Human-readable reason an integration cannot run yet, or null when it is
 * ready.
 */
export function integrationBlocker(id: IntegrationId, config: Record<string, any>): string | null {
  const { valid, missing } = validateIntegrationConfig(id, config);
  if (valid) return null;
  return `Missing ${missing.join(', ')}. Configure it in Integrations.`;
}

export { INTEGRATION_IDS, validateIntegrationConfig };
export type { IntegrationConfigMap, IntegrationId };
