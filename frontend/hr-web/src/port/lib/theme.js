import { useEffect, useState } from 'react';
const KEY = 'ariba_ui_theme';
const get = () => { try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; } };
export function applyTheme(v) { document.documentElement.setAttribute('data-ariba-theme', v); try { localStorage.setItem(KEY, v); } catch { /* ignore */ } }
export function useTheme() {
  const [t, setT] = useState(get);
  useEffect(() => { document.documentElement.setAttribute('data-ariba-theme', t); }, [t]);
  return [t, () => { const n = t === 'dark' ? 'light' : 'dark'; applyTheme(n); setT(n); }];
}
export const initTheme = () => document.documentElement.setAttribute('data-ariba-theme', get());
