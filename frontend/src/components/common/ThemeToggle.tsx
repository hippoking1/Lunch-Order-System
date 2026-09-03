import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { LS_THEME_KEY } from '../../constants';

type Theme = 'dark' | 'light';

function getStoredTheme(): Theme {
  return (localStorage.getItem(LS_THEME_KEY) as Theme) || 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(LS_THEME_KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="切換主題"
      type="button"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
