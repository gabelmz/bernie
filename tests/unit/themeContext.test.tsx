import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ThemeProvider, useTheme, themePresets, defaultTheme } from '@/contexts/ThemeContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeContext & ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default theme when no saved theme in localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme.surface).toBe(defaultTheme.surface);
    expect(result.current.theme.text).toBe(defaultTheme.text);
    expect(result.current.theme.highlight).toBe(defaultTheme.highlight);
  });

  it('allows switching to a different preset and persists to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme(themePresets.light.theme);
    });

    expect(result.current.theme.background.primary).toBe('#ffffff');
    const stored = JSON.parse(localStorage.getItem('stitch-theme-v2') || '{}');
    expect(stored.background.primary).toBe('#ffffff');
  });

  it('updates CSS custom properties on document root when theme changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme(themePresets.cyberpunk.theme);
    });

    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue('--theme-highlight')).toBe(themePresets.cyberpunk.theme.highlight);
  });
});
