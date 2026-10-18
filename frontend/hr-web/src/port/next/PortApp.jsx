// ADAPTED (not in their source): their App.jsx for Next.js — restore the session, then their store (AppProvider),
// their Layout around the page, the idle guard and the toasts. Signed out → our /login page (their Login screen).
'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import * as auth from '../lib/auth.js';
import { initTheme } from '../lib/theme.js';
import { AppProvider, usePerm } from '../store/AppStore.jsx';
import Layout from '../components/Layout.jsx';
import IdleGuard from '../components/IdleGuard.jsx';
import { ToastHost } from '../components/Toast.jsx';
import { OutletProvider, fromNext } from '../router.jsx';
import { MODS } from '../nav.js';

function Guard({ children }) {
  const perm = usePerm();
  const id = fromNext(usePathname()).split('/')[1] || 'dash';
  const m = MODS[id];
  if (m && !perm.can(m)) return <div className="pg on" style={{ padding: 30, color: 'var(--am)' }}>ما عندكش صلاحية الصفحة دي</div>;
  return children;
}

export default function PortApp({ children }) {
  const [booting, setBooting] = useState(true);
  const router = useRouter(), path = usePathname();
  useSyncExternalStore(auth.subscribe, auth.getVersion, auth.getVersion);
  useEffect(() => { initTheme(); auth.restore().finally(() => setBooting(false)); }, []);
  const authed = auth.isAuthed();
  useEffect(() => { if (!booting && !authed) router.replace('/login?next=' + encodeURIComponent(path)); }, [booting, authed, router, path]);
  if (booting || !authed) return <div style={{ position: 'fixed', inset: 0, background: '#202522' }} />;
  return (
    <AppProvider>
      <OutletProvider value={<Guard>{children}</Guard>}>
        <Layout />
      </OutletProvider>
      <IdleGuard />
      <ToastHost />
    </AppProvider>
  );
}
