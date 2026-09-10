import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { ThemeProvider, useTheme, themePresets, defaultTheme, solarizedLightTheme } from '@/contexts/ThemeContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeContext & ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens on Solarized Light when nothing is saved', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme.surface).toBe(solarizedLightTheme.surface);
    expect(result.current.theme.text).toBe(solarizedLightTheme.text);
    expect(result.current.theme.highlight).toBe(solarizedLightTheme.highlight);
  });

  it('keeps the dark preset available rather than replacing it', () => {
    expect(themePresets.default.theme).toEqual(defaultTheme);
    expect(themePresets.solarizedLight.theme).toEqual(solarizedLightTheme);
  });

  it('reads eggshell rather than Solarized cream', () => {
    // base3 is #fdf6e3; this sits further from yellow and stays off-white.
    expect(solarizedLightTheme.background.primary).toBe('#f5f1e8');
    expect(solarizedLightTheme.background.primary).not.toBe('#fdf6e3');
  });

  it('labels the document light or dark so index.css can re-tone status panels', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.dataset.themeMode).toBe('light');

    act(() => {
      result.current.setTheme(defaultTheme);
    });
    expect(document.documentElement.dataset.themeMode).toBe('dark');

    act(() => {
      result.current.setTheme(themePresets.sepia.theme);
    });
    expect(document.documentElement.dataset.themeMode).toBe('light');
  });

  it('derives a border and a hover from the theme instead of the dark literal', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme(solarizedLightTheme);
    });

    const root = document.documentElement.style;
    expect(root.getPropertyValue('--theme-border')).toContain(solarizedLightTheme.background.secondary);
    expect(root.getPropertyValue('--theme-highlight-hover')).toContain(solarizedLightTheme.highlight);
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
