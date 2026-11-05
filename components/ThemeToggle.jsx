'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved;
      try { saved = localStorage.getItem('areium-theme'); } catch {}
      const value = ['light', 'dark'].includes(saved) ? saved : media.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = value;
      setTheme(value);
    };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const label = theme === 'dark' ? '切换为日间模式' : '切换为夜间模式';
  return <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={() => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('areium-theme', next); } catch {}
    setTheme(next);
  }}><span className="theme-toggle-content theme-toggle-day" aria-hidden="true"><Sun size={20}/><span>日间</span></span><span className="theme-toggle-content theme-toggle-night" aria-hidden="true"><Moon size={20}/><span>夜间</span></span></button>;
}
