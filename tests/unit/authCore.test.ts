import { describe, it, expect } from 'vitest';
import {
  GOOGLE_SCOPES,
  buildAuthorizeUrl,
  decodeUserFromToken,
  describeAuthRedirectError,
  isTokenFresh,
  normalizeSupabaseUrl,
  parseAuthFragment,
} from '@/lib/authCore';

/** Builds an unsigned JWT with the given payload, as Supabase would return. */
function fakeJwt(payload: Record<string, any>): string {
  const encode = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('Supabase authorize URL', () => {
  it('trims a trailing slash off the project URL', () => {
    expect(normalizeSupabaseUrl('https://demo.supabase.co/')).toBe('https://demo.supabase.co');
    expect(normalizeSupabaseUrl('  https://demo.supabase.co  ')).toBe('https://demo.supabase.co');
    expect(normalizeSupabaseUrl(undefined)).toBe('');
  });

  it('targets the Google provider and carries the redirect and scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({ url: 'https://demo.supabase.co' }, 'http://localhost:3000/')
    );

    expect(url.origin + url.pathname).toBe('https://demo.supabase.co/auth/v1/authorize');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toBe('http://localhost:3000/');
    expect(url.searchParams.get('scopes')).toBe(GOOGLE_SCOPES);
  });

  it('requests the Drive and Sheets scopes the nodes depend on', () => {
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/drive');
    expect(GOOGLE_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets');
  });

  it('asks for offline consent only when requested', () => {
    const plain = new URL(buildAuthorizeUrl({ url: 'https://demo.supabase.co' }, 'http://x/'));
    expect(plain.searchParams.get('prompt')).toBeNull();

    const consent = new URL(
      buildAuthorizeUrl({ url: 'https://demo.supabase.co' }, 'http://x/', { consent: true })
    );
    expect(consent.searchParams.get('access_type')).toBe('offline');
    expect(consent.searchParams.get('prompt')).toBe('consent');
  });

  it('refuses to build a URL without a project or a redirect', () => {
    expect(() => buildAuthorizeUrl({}, 'http://x/')).toThrow(/project URL/i);
    expect(() => buildAuthorizeUrl({ url: 'https://demo.supabase.co' }, '')).toThrow(/redirect URL is required/i);
  });
});

describe('Redirect fragment parsing', () => {
  it('returns null when the fragment carries no auth response', () => {
    expect(parseAuthFragment('')).toBeNull();
    expect(parseAuthFragment('#')).toBeNull();
    expect(parseAuthFragment('#some=other')).toBeNull();
  });

  it('reads the Supabase and Google tokens out of the fragment', () => {
    const result = parseAuthFragment(
      '#access_token=supa-token&refresh_token=refresh&provider_token=google-token&provider_refresh_token=g-refresh&expires_in=3600&token_type=bearer',
      1_000_000
    );

    expect(result && 'tokens' in result).toBe(true);
    const tokens = (result as any).tokens;
    expect(tokens.accessToken).toBe('supa-token');
    expect(tokens.refreshToken).toBe('refresh');
    expect(tokens.providerToken).toBe('google-token');
    expect(tokens.providerRefreshToken).toBe('g-refresh');
    expect(tokens.expiresAt).toBe(1_000_000 + 3600 * 1000);
  });

  it('prefers an absolute expires_at over the relative expires_in', () => {
    const result = parseAuthFragment('#access_token=t&expires_at=2000&expires_in=3600', 0);
    expect((result as any).tokens.expiresAt).toBe(2_000_000);
  });

  it('defaults to an hour when no expiry is given', () => {
    const result = parseAuthFragment('#access_token=t', 0);
    expect((result as any).tokens.expiresAt).toBe(3600 * 1000);
  });

  it('surfaces a provider error instead of a session', () => {
    const result = parseAuthFragment(
      '#error=access_denied&error_code=403&error_description=User+declined'
    );

    expect(result && 'error' in result).toBe(true);
    expect((result as any).error).toEqual({
      error: 'access_denied',
      code: '403',
      description: 'User declined',
    });
  });

  it('treats a fragment without an access token as no response', () => {
    expect(parseAuthFragment('#provider_token=only-google')).toBeNull();
  });
});

describe('Identity from the access token', () => {
  it('reads the id, email and profile metadata', () => {
    const token = fakeJwt({
      sub: 'user-123',
      email: 'gabe@example.com',
      user_metadata: { full_name: 'Gabe M', avatar_url: 'https://img.test/a.png' },
    });

    expect(decodeUserFromToken(token)).toEqual({
      id: 'user-123',
      email: 'gabe@example.com',
      name: 'Gabe M',
      avatarUrl: 'https://img.test/a.png',
    });
  });

  it('falls back through the metadata aliases Google sends', () => {
    const token = fakeJwt({ sub: 'u', user_metadata: { name: 'Alt', picture: 'https://img.test/p.png' } });
    const user = decodeUserFromToken(token);

    expect(user?.name).toBe('Alt');
    expect(user?.avatarUrl).toBe('https://img.test/p.png');
    expect(user?.email).toBeNull();
  });

  it('survives non-ASCII names', () => {
    const token = fakeJwt({ sub: 'u', user_metadata: { full_name: 'Ana López 日本' } });
    expect(decodeUserFromToken(token)?.name).toBe('Ana López 日本');
  });

  it('returns null for anything that is not a readable token', () => {
    expect(decodeUserFromToken('')).toBeNull();
    expect(decodeUserFromToken('not-a-jwt')).toBeNull();
    expect(decodeUserFromToken('a.!!!.c')).toBeNull();
    // A token with no subject identifies nobody.
    expect(decodeUserFromToken(fakeJwt({ email: 'x@y.z' }))).toBeNull();
  });
});

describe('Token freshness', () => {
  it('expires a token early by the safety margin', () => {
    const now = 1_000_000;
    expect(isTokenFresh(now + 10 * 60 * 1000, 5 * 60 * 1000, now)).toBe(true);
    // Inside the margin counts as stale, so in-flight calls do not 401.
    expect(isTokenFresh(now + 2 * 60 * 1000, 5 * 60 * 1000, now)).toBe(false);
    expect(isTokenFresh(now - 1, 5 * 60 * 1000, now)).toBe(false);
  });

  it('treats a missing expiry as stale', () => {
    expect(isTokenFresh(NaN)).toBe(false);
    expect(isTokenFresh(0)).toBe(false);
  });
});

describe('Redirect error messages', () => {
  it('names the redirect URL that has to be allow-listed', () => {
    const message = describeAuthRedirectError(
      { error: 'invalid_request', code: 'bad_redirect', description: 'redirect_uri mismatch' },
      'http://localhost:3000/'
    );
    expect(message).toContain('http://localhost:3000/');
    expect(message).toMatch(/Redirect URLs/i);
  });

  it('points at the provider setting when Google is not enabled', () => {
    const message = describeAuthRedirectError({
      error: 'invalid_request',
      code: 'provider_disabled',
      description: 'Provider is not enabled',
    });
    expect(message).toMatch(/Authentication, Providers, Google/i);
  });

  it('explains a declined consent screen', () => {
    expect(describeAuthRedirectError({ error: 'x', code: 'access_denied', description: null })).toMatch(
      /cancelled or Google declined/i
    );
  });

  it('falls back to the provider description', () => {
    expect(describeAuthRedirectError({ error: 'server_error', code: null, description: 'Upstream blew up' })).toBe(
      'Upstream blew up'
    );
  });
});
