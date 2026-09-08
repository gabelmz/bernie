/**
 * Browser-side Supabase Google sign-in. Replaces the previous Firebase Auth
 * path: Supabase issues the session, and the Google `provider_token` it returns
 * is what the Drive, Sheets, Chat and Meet nodes call googleapis.com with.
 *
 * Setup required on the Supabase project (Bernie cannot do this for you):
 *   1. Authentication, Providers, Google: enable it and paste a Google OAuth
 *      client id + secret.
 *   2. Authentication, URL Configuration, Redirect URLs: add this app's origin.
 *   3. Connections & APIs: set the project URL and the anon/publishable key.
 */

import {
  AuthTokens,
  AuthUser,
  GOOGLE_SCOPES,
  SupabaseAuthConfig,
  buildAuthorizeUrl,
  decodeUserFromToken,
  describeAuthRedirectError,
  isTokenFresh,
  normalizeSupabaseUrl,
  parseAuthFragment,
} from './authCore';
import { configFor } from './integrations';

const SESSION_STORAGE_KEY = 'bernie-supabase-session';
/** Google access tokens last an hour and Supabase does not refresh them. */
const PROVIDER_TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export const AUTH_CHANGED_EVENT = 'bernie:auth-changed';

export interface StoredSession {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
  providerToken: string | null;
  /** Epoch millis at which the Google token is assumed to have expired. */
  providerExpiresAt: number;
}

let cached: StoredSession | null = null;

function readSession(): StoredSession | null {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken && parsed?.user?.id) {
      cached = parsed as StoredSession;
      return cached;
    }
  } catch {
    // Unreadable storage is treated as "signed out".
  }
  return null;
}

function writeSession(session: StoredSession | null): void {
  cached = session;
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Keep the in-memory copy when storage is blocked.
  }
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: session }));
}

/** The Supabase project URL + anon key, taken from the Connections config. */
export function authConfig(): SupabaseAuthConfig {
  const config = configFor('supabase');
  return { url: config.url, anonKey: config.anonKey };
}

/** True once the project URL is set, which is all sign-in needs to start. */
export function isAuthConfigured(): boolean {
  return Boolean(normalizeSupabaseUrl(authConfig().url));
}

/** Where Supabase should send the browser back to after Google. */
export function redirectTarget(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Hands the browser to Supabase to begin Google sign-in. This navigates away,
 * so it never returns normally.
 */
export function startGoogleSignIn(options: { consent?: boolean } = {}): void {
  const url = buildAuthorizeUrl(authConfig(), redirectTarget(), {
    scopes: GOOGLE_SCOPES,
    consent: options.consent,
  });
  window.location.assign(url);
}

function toStoredSession(tokens: AuthTokens): StoredSession | null {
  const user = decodeUserFromToken(tokens.accessToken);
  if (!user) return null;

  return {
    user,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    providerToken: tokens.providerToken,
    providerExpiresAt: tokens.providerToken ? Date.now() + PROVIDER_TOKEN_LIFETIME_MS : 0,
  };
}

/**
 * Consumes the auth response Supabase leaves in the URL fragment. Call once on
 * app start. Returns the signed-in session, or throws with an actionable
 * message when Supabase reported an error. The fragment is stripped either way
 * so tokens do not linger in the address bar or in history.
 */
export function completeSignInFromRedirect(): StoredSession | null {
  const result = parseAuthFragment(window.location.hash);
  if (!result) return null;

  const clearHash = () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  if ('error' in result) {
    clearHash();
    throw new Error(describeAuthRedirectError(result.error, redirectTarget()));
  }

  const session = toStoredSession(result.tokens);
  clearHash();

  if (!session) {
    throw new Error('Supabase returned a session Bernie could not read. Try signing in again.');
  }

  writeSession(session);
  return session;
}

export function getSession(): StoredSession | null {
  const session = readSession();
  if (!session) return null;

  if (!isTokenFresh(session.expiresAt)) {
    // The Supabase session itself has lapsed; require a fresh sign-in.
    writeSession(null);
    return null;
  }
  return session;
}

export function getUser(): AuthUser | null {
  return getSession()?.user ?? null;
}

/**
 * The Google API access token, or null when absent or aged out. Callers must
 * treat null as "ask the user to reconnect Google".
 */
export async function getAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session?.providerToken) return null;

  if (!isTokenFresh(session.providerExpiresAt)) {
    writeSession({ ...session, providerToken: null, providerExpiresAt: 0 });
    return null;
  }
  return session.providerToken;
}

/** Synchronous check for rendering connected vs reconnect affordances. */
export function hasGoogleAccess(): boolean {
  const session = getSession();
  return Boolean(session?.providerToken && isTokenFresh(session.providerExpiresAt));
}

/** Revokes the Supabase session, best effort, then clears local state. */
export async function signOut(): Promise<void> {
  const session = readSession();
  const { url, anonKey } = authConfig();
  const base = normalizeSupabaseUrl(url);

  if (session && base && anonKey) {
    try {
      await fetch(`${base}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: String(anonKey),
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch {
      // A failed revoke must not strand the user in a signed-in UI.
    }
  }

  writeSession(null);
}

/**
 * Subscribes to sign-in state. The second callback argument is the Google API
 * token, which is null when the session exists without usable Google access —
 * the user is signed in but must reconnect before Google nodes can run.
 */
export function initAuth(
  onUser?: (user: AuthUser, token: string | null) => void,
  onSignedOut?: () => void
): () => void {
  const emit = () => {
    const session = getSession();
    if (!session) {
      onSignedOut?.();
      return;
    }
    const token = session.providerToken && isTokenFresh(session.providerExpiresAt) ? session.providerToken : null;
    onUser?.(session.user, token);
  };

  emit();
  window.addEventListener(AUTH_CHANGED_EVENT, emit);
  return () => window.removeEventListener(AUTH_CHANGED_EVENT, emit);
}

export { GOOGLE_SCOPES };
export type { AuthUser };
