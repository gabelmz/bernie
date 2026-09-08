/**
 * Pure helpers for Supabase Google sign-in. Kept free of browser globals so the
 * URL building and redirect parsing can be unit tested directly.
 *
 * Bernie uses Supabase's implicit OAuth flow: the app hands the browser to
 * `/auth/v1/authorize`, Supabase bounces through Google and returns to the app
 * with the tokens in the URL fragment. The Google `provider_token` in that
 * fragment is what the Drive and Sheets nodes call googleapis.com with.
 */

/** Scopes the Drive, Sheets, Chat and Meet nodes need from Google. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/meetings.space.created',
].join(' ');

export interface SupabaseAuthConfig {
  url?: string;
  anonKey?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string | null;
  /** The Google OAuth token, present only on a fresh sign-in. */
  providerToken: string | null;
  providerRefreshToken: string | null;
  /** Epoch millis at which the Supabase access token expires. */
  expiresAt: number;
}

export interface AuthRedirectError {
  error: string;
  code: string | null;
  description: string | null;
}

/** Normalizes a Supabase project URL to its origin, without a trailing slash. */
export function normalizeSupabaseUrl(url: string | undefined): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Builds the Supabase authorize URL that starts Google sign-in.
 * `redirectTo` must be listed as a redirect URL in the Supabase dashboard.
 */
export function buildAuthorizeUrl(
  config: SupabaseAuthConfig,
  redirectTo: string,
  options: { scopes?: string; consent?: boolean } = {}
): string {
  const base = normalizeSupabaseUrl(config.url);
  if (!base) throw new Error('Supabase sign-in: set the project URL under Connections & APIs.');
  if (!redirectTo) throw new Error('Supabase sign-in: a redirect URL is required.');

  const params = new URLSearchParams();
  params.set('provider', 'google');
  params.set('redirect_to', redirectTo);
  params.set('scopes', options.scopes || GOOGLE_SCOPES);

  if (options.consent) {
    // Forces the Google consent screen so a provider refresh token is issued.
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  return `${base}/auth/v1/authorize?${params.toString()}`;
}

/**
 * Reads the tokens Supabase appends to the URL fragment after a redirect.
 * Returns null when the fragment carries no auth response.
 */
export function parseAuthFragment(
  hash: string,
  now: number = Date.now()
): { tokens: AuthTokens } | { error: AuthRedirectError } | null {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);

  const error = params.get('error');
  if (error) {
    return {
      error: {
        error,
        code: params.get('error_code'),
        description: params.get('error_description')?.replace(/\+/g, ' ') || null,
      },
    };
  }

  const accessToken = params.get('access_token');
  if (!accessToken) return null;

  const expiresIn = Number(params.get('expires_in'));
  const expiresAtParam = Number(params.get('expires_at'));
  const expiresAt = Number.isFinite(expiresAtParam) && expiresAtParam > 0
    ? expiresAtParam * 1000
    : now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3600 * 1000);

  return {
    tokens: {
      accessToken,
      refreshToken: params.get('refresh_token'),
      providerToken: params.get('provider_token'),
      providerRefreshToken: params.get('provider_refresh_token'),
      expiresAt,
    },
  };
}

function decodeBase64Url(segment: string): string | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const decoded = typeof atob === 'function'
      ? atob(padded + padding)
      : Buffer.from(padded + padding, 'base64').toString('binary');
    // Recover UTF-8 from the binary string so non-ASCII names survive.
    return decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
  } catch {
    return null;
  }
}

/**
 * Pulls the display identity out of a Supabase access token. The signature is
 * NOT verified: this is for showing who is signed in, never for authorization,
 * which always happens server-side against Supabase.
 */
export function decodeUserFromToken(accessToken: string): AuthUser | null {
  const parts = String(accessToken || '').split('.');
  if (parts.length < 2) return null;

  const json = decodeBase64Url(parts[1]);
  if (!json) return null;

  try {
    const claims = JSON.parse(json);
    if (!claims?.sub) return null;

    const meta = claims.user_metadata || {};
    return {
      id: String(claims.sub),
      email: claims.email || meta.email || null,
      name: meta.full_name || meta.name || null,
      avatarUrl: meta.avatar_url || meta.picture || null,
    };
  } catch {
    return null;
  }
}

/** True when a token is still usable, allowing for a safety margin. */
export function isTokenFresh(expiresAt: number, safetyMs = 5 * 60 * 1000, now: number = Date.now()): boolean {
  return Number.isFinite(expiresAt) && expiresAt - safetyMs > now;
}

/**
 * Turns a Supabase auth redirect error into something actionable. The common
 * local-development failure is a redirect URL that the project does not allow.
 */
export function describeAuthRedirectError(error: AuthRedirectError, redirectTo?: string): string {
  const code = String(error.code || error.error || '').toLowerCase();
  const description = error.description || '';

  if (code.includes('redirect') || /redirect/i.test(description)) {
    return `Supabase rejected the redirect${redirectTo ? ` to ${redirectTo}` : ''}. Add that URL under Authentication, URL Configuration, Redirect URLs.`;
  }
  if (code.includes('provider') || /provider is not enabled/i.test(description)) {
    return 'Google is not enabled as a provider on this Supabase project. Enable it under Authentication, Providers, Google.';
  }
  if (code === 'access_denied') {
    return 'Sign-in was cancelled or Google declined the requested permissions.';
  }
  return description || `Supabase sign-in failed (${error.error}).`;
}
