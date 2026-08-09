import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'fifa-manager-theme';

const getSystemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark');
  const [resolvedTheme, setResolvedTheme] = useState(() => (mode === 'auto' ? (getSystemPrefersDark() ? 'dark' : 'light') : mode));

  useEffect(() => {
    const applyResolved = () => {
      const next = mode === 'auto' ? (getSystemPrefersDark() ? 'dark' : 'light') : mode;
      setResolvedTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };
    applyResolved();

    if (mode === 'auto') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', applyResolved);
      return () => media.removeEventListener('change', applyResolved);
    }
  }, [mode]);

  const setMode = (next) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return <ThemeContext.Provider value={{ mode, setMode, resolvedTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
