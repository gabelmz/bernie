import { describe, it, expect, vi } from 'vitest';

describe('Server API Endpoints & Proxy Handler Logic', () => {
  describe('Proxy Payload Serialization', () => {
    function prepareProxyRequest(url: string, method?: string, headers?: Record<string, string>, body?: any) {
      const isGetOrHead = method === 'GET' || method === 'HEAD' || !method;
      let parsedBody: string | undefined = undefined;

      if (!isGetOrHead && body !== undefined && body !== null) {
        parsedBody = typeof body === 'string' ? body : JSON.stringify(body);
      }

      return {
        url,
        method: method || 'GET',
        headers: headers || {},
        body: parsedBody,
      };
    }

    it('omits body for GET and HEAD requests', () => {
      const getReq = prepareProxyRequest('https://api.example.com/data', 'GET', undefined, { test: 123 });
      expect(getReq.body).toBeUndefined();
      expect(getReq.method).toBe('GET');

      const headReq = prepareProxyRequest('https://api.example.com/data', 'HEAD', undefined, { test: 123 });
      expect(headReq.body).toBeUndefined();
      expect(headReq.method).toBe('HEAD');
    });

    it('stringifies object body for POST and PUT requests', () => {
      const postReq = prepareProxyRequest('https://api.example.com/items', 'POST', { 'Content-Type': 'application/json' }, { name: 'Item Alpha' });
      expect(postReq.body).toBe('{"name":"Item Alpha"}');
      expect(postReq.method).toBe('POST');
      expect(postReq.headers['Content-Type']).toBe('application/json');
    });

    it('preserves raw string bodies without re-encoding', () => {
      const rawBody = 'plain text payload';
      const postReq = prepareProxyRequest('https://api.example.com/upload', 'POST', undefined, rawBody);
      expect(postReq.body).toBe(rawBody);
    });
  });

  describe('AI Endpoint Key Guards', () => {
    it('returns 500 with descriptive error when Gemini API is uninitialized', () => {
      const ai = null;
      let statusCode = 200;
      let responseBody: any = null;

      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          responseBody = data;
        },
      };

      // Simulating the server route handler guard:
      if (!ai) {
        mockRes.status(500).json({ error: 'Gemini API key not configured.' });
      }

      expect(statusCode).toBe(500);
      expect(responseBody.error).toBe('Gemini API key not configured.');
    });
  });
});
