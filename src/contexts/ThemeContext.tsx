import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemePreset {
  background: {
    primary: string;
    secondary: string;
  };
  gradient: {
    primary: string;
    secondary: string;
  };
  surface: string;
  text: string;
  transparency: string;
  density: string;
  edges: string;
  highlight: string;
  brightness: string;
  depth: string;
}

export const defaultTheme: ThemePreset = {
  background: {
    primary: '#09090b',
    secondary: '#18181b'
  },
  gradient: {
    primary: 'none',
    secondary: 'none'
  },
  surface: '#27272a',
  text: '#fafafa',
  transparency: '90',
  density: 'comfortable',
  edges: 'rounded',
  highlight: '#6366f1',
  brightness: '100',
  depth: 'elevated'
};

export const themePresets: Record<string, { name: string; theme: ThemePreset }> = {
  default: { name: 'Dark Default', theme: defaultTheme },
  light: {
    name: 'Clean Light',
    theme: {
      background: { primary: '#ffffff', secondary: '#f4f4f5' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#ffffff',
      text: '#09090b',
      transparency: '95',
      density: 'comfortable',
      edges: 'rounded',
      highlight: '#3b82f6',
      brightness: '100',
      depth: 'shadow'
    }
  },
  cyberpunk: {
    name: 'Cyberpunk',
    theme: {
      background: { primary: '#0d0221', secondary: '#261447' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#261447',
      text: '#00ff41',
      transparency: '90',
      density: 'compact',
      edges: 'sharp',
      highlight: '#ff003c',
      brightness: '110',
      depth: 'flat'
    }
  },
  ocean: {
    name: 'Deep Ocean',
    theme: {
      background: { primary: '#0f172a', secondary: '#1e293b' },
      gradient: { primary: 'linear-gradient(to right, #0f172a, #1e293b)', secondary: 'none' },
      surface: '#1e293b',
      text: '#e2e8f0',
      transparency: '85',
      density: 'spacious',
      edges: 'pill',
      highlight: '#38bdf8',
      brightness: '100',
      depth: 'elevated'
    }
  },
  forest: {
    name: 'Forest Canopy',
    theme: {
      background: { primary: '#14532d', secondary: '#166534' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#166534',
      text: '#f0fdf4',
      transparency: '90',
      density: 'comfortable',
      edges: 'rounded',
      highlight: '#4ade80',
      brightness: '95',
      depth: 'shadow'
    }
  },
  sunset: {
    name: 'Sunset Glow',
    theme: {
      background: { primary: '#450a0a', secondary: '#7f1d1d' },
      gradient: { primary: 'linear-gradient(to right, #7f1d1d, #ea580c)', secondary: 'none' },
      surface: '#7f1d1d',
      text: '#fffbeb',
      transparency: '90',
      density: 'spacious',
      edges: 'rounded',
      highlight: '#fcd34d',
      brightness: '105',
      depth: 'elevated'
    }
  },
  dracula: {
    name: 'Dracula',
    theme: {
      background: { primary: '#282a36', secondary: '#44475a' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#44475a',
      text: '#f8f8f2',
      transparency: '100',
      density: 'comfortable',
      edges: 'rounded',
      highlight: '#bd93f9',
      brightness: '100',
      depth: 'shadow'
    }
  },
  synthwave: {
    name: 'Synthwave',
    theme: {
      background: { primary: '#2a2139', secondary: '#34294f' },
      gradient: { primary: 'linear-gradient(to bottom, #2a2139, #34294f)', secondary: 'none' },
      surface: '#34294f',
      text: '#f97e72',
      transparency: '80',
      density: 'spacious',
      edges: 'sharp',
      highlight: '#ff7edb',
      brightness: '110',
      depth: 'elevated'
    }
  },
  monochrome: {
    name: 'Monochrome',
    theme: {
      background: { primary: '#000000', secondary: '#111111' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#111111',
      text: '#ffffff',
      transparency: '100',
      density: 'compact',
      edges: 'sharp',
      highlight: '#ffffff',
      brightness: '100',
      depth: 'flat'
    }
  },
  lavender: {
    name: 'Lavender Mist',
    theme: {
      background: { primary: '#faf5ff', secondary: '#f3e8ff' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#f3e8ff',
      text: '#4c1d95',
      transparency: '95',
      density: 'spacious',
      edges: 'pill',
      highlight: '#9333ea',
      brightness: '100',
      depth: 'shadow'
    }
  },
  neon: {
    name: 'Neon Tokyo',
    theme: {
      background: { primary: '#000000', secondary: '#1a1a1a' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#1a1a1a',
      text: '#00ffff',
      transparency: '90',
      density: 'comfortable',
      edges: 'rounded',
      highlight: '#ff00ff',
      brightness: '120',
      depth: 'elevated'
    }
  },
  sepia: {
    name: 'Vintage Sepia',
    theme: {
      background: { primary: '#fdf6e3', secondary: '#eee8d5' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#eee8d5',
      text: '#657b83',
      transparency: '100',
      density: 'spacious',
      edges: 'rounded',
      highlight: '#cb4b16',
      brightness: '95',
      depth: 'flat'
    }
  },
  nord: {
    name: 'Nord Frost',
    theme: {
      background: { primary: '#2e3440', secondary: '#3b4252' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#3b4252',
      text: '#eceff4',
      transparency: '100',
      density: 'comfortable',
      edges: 'rounded',
      highlight: '#88c0d0',
      brightness: '100',
      depth: 'shadow'
    }
  },
  mint: {
    name: 'Mint Breeze',
    theme: {
      background: { primary: '#f0fdf4', secondary: '#dcfce7' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#dcfce7',
      text: '#14532d',
      transparency: '95',
      density: 'comfortable',
      edges: 'pill',
      highlight: '#16a34a',
      brightness: '100',
      depth: 'elevated'
    }
  },
  solarized: {
    name: 'Solarized Dark',
    theme: {
      background: { primary: '#002b36', secondary: '#073642' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#073642',
      text: '#839496',
      transparency: '100',
      density: 'compact',
      edges: 'sharp',
      highlight: '#b58900',
      brightness: '100',
      depth: 'flat'
    }
  },
  hacker: {
    name: 'Matrix Hacker',
    theme: {
      background: { primary: '#000000', secondary: '#050505' },
      gradient: { primary: 'none', secondary: 'none' },
      surface: '#050505',
      text: '#00ff00',
      transparency: '90',
      density: 'compact',
      edges: 'sharp',
      highlight: '#00ff00',
      brightness: '100',
      depth: 'flat'
    }
  }
};

interface ThemeContextType {
  theme: ThemePreset;
  setTheme: React.Dispatch<React.SetStateAction<ThemePreset>>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreset>(() => {
    const saved = localStorage.getItem('stitch-theme-v2');
    return saved ? JSON.parse(saved) : defaultTheme;
  });

  useEffect(() => {
    localStorage.setItem('stitch-theme-v2', JSON.stringify(theme));
    
    const root = document.documentElement;
    root.style.setProperty('--theme-bg-primary', theme.background.primary);
    root.style.setProperty('--theme-bg-secondary', theme.background.secondary);
    
    root.style.setProperty('--theme-grad-primary', theme.gradient.primary === 'none' ? theme.background.primary : theme.gradient.primary);
    root.style.setProperty('--theme-grad-secondary', theme.gradient.secondary === 'none' ? theme.background.secondary : theme.gradient.secondary);
    
    root.style.setProperty('--theme-surface', theme.surface);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-highlight', theme.highlight);
    
    const trans = 100 - Number(theme.transparency || '100');
    root.style.setProperty('--theme-trans-percent', `${trans}%`);
    root.style.setProperty('--theme-brightness', `brightness(${theme.brightness || '100'}%)`);
    
    let radius = '0px';
    if (theme.edges === 'rounded') radius = '12px';
    if (theme.edges === 'pill') radius = '24px';
    root.style.setProperty('--theme-radius', radius);
    root.style.setProperty('--theme-radius-inner', theme.edges === 'sharp' ? '0px' : '8px');

    let shadow = 'none';
    if (theme.depth === 'shadow') shadow = '0 10px 30px -10px rgba(0, 0, 0, 0.5)';
    if (theme.depth === 'elevated') shadow = '0 8px 32px -8px rgba(0, 0, 0, 0.8)';
    root.style.setProperty('--theme-shadow', shadow);

    let padding = '1rem';
    if (theme.density === 'compact') padding = '0.5rem';
    if (theme.density === 'spacious') padding = '1.5rem';
    root.style.setProperty('--theme-padding', padding);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
