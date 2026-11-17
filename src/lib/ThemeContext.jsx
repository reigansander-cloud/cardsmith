import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const THEMES = {
  midnight: {
    name: 'Midnight',
    colors: {
      background: '240 15% 5%',
      foreground: '240 10% 95%',
      card: '240 12% 10%',
      primary: '260 70% 60%',
      accent: '280 60% 50%',
    }
  }
};

export function ThemeProvider({ children }) {
  const [activeTheme, setActiveTheme] = useState('midnight');

  useEffect(() => {
    const root = document.documentElement;
    const theme = THEMES[activeTheme];
    if (theme) {
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}