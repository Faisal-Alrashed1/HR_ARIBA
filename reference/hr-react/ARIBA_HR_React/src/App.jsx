import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import * as auth from './lib/auth.js';
import { AppProvider, usePerm } from './store/AppStore.jsx';
import Login from './components/Login.jsx';
import Layout from './components/Layout.jsx';
import IdleGuard from './components/IdleGuard.jsx';
import { ToastHost } from './components/Toast.jsx';
import { MODS } from './nav.js';
import Dashboard from './pages/Dashboard.jsx';
import { PAGES } from './pages/registry.js';
import { LeaveSnapshotSync } from './lib/leaveSnapshots.js';

function Guard({ id, children }) {
  const perm = usePerm();
  const m = MODS[id];
  if (m && !perm.can(m)) return <div className="pg on" style={{ padding: 30, color: 'var(--am)' }}>ما عندكش صلاحية الصفحة دي</div>;
  return children;
}

function Authed() {
  return (
    <AppProvider>
      <LeaveSnapshotSync />
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dash" replace />} />
            <Route path="dash" element={<Guard id="dash"><Dashboard /></Guard>} />
            {PAGES.map(([id, Comp]) => <Route key={id} path={id + '/*'} element={<Guard id={id}><Suspense fallback={<div className="pg on" style={{ padding: 20 }}>…</div>}><Comp /></Suspense></Guard>} />)}
            <Route path="*" element={<Navigate to="/dash" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  useSyncExternalStore(auth.subscribe, auth.getVersion);
  useEffect(() => { auth.restore().finally(() => setBooting(false)); }, []);
  if (booting) return <div style={{ position: 'fixed', inset: 0, background: '#202522' }} />;
  return (
    <>
      {auth.isAuthed() ? <Authed /> : <Login />}
      {auth.isAuthed() && <IdleGuard />}
      <ToastHost />
    </>
  );
}
