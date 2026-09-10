import '@testing-library/jest-dom/vitest';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Server-side suites run with `@vitest-environment node` and have no DOM to
// shim. Everything below is jsdom-only, so bail rather than throw on `window`.
const hasDom = typeof window !== 'undefined';

// Mock ResizeObserver for xyflow/react and responsive components
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (hasDom) {
  window.ResizeObserver = window.ResizeObserver || MockResizeObserver;
}

// Mock matchMedia
if (hasDom) Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage if not fully implemented in jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
if (hasDom) Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
