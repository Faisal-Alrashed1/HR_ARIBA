// ADAPTED (not in their source): their Login screen as our /login page; once signed in, go to the page asked for.
'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as auth from '../lib/auth.js';
import { initTheme } from '../lib/theme.js';
import Login from '../components/Login.jsx';
import { ToastHost } from '../components/Toast.jsx';

export default function LoginApp() {
  const router = useRouter(), params = useSearchParams();
  useSyncExternalStore(auth.subscribe, auth.getVersion, auth.getVersion);
  useEffect(() => { initTheme(); }, []);
  const authed = auth.isAuthed();
  useEffect(() => {
    if (!authed) return;
    const next = params.get('next');
    const role = auth.state.role;
    const home = role === 'employee' || role === 'manager' ? '/me' : '/dashboard';
    router.replace(next && next.startsWith('/') && !next.startsWith('//') && next !== '/login' ? next : home);
  }, [authed, params, router]);
  return <><Login /><ToastHost /></>;
}
