// ADAPTED (not in their source): their app runs in the browser only (window, localStorage, sessionStorage at render).
'use client';
import './latn.js';
import dynamic from 'next/dynamic';

const PortApp = dynamic(() => import('./PortApp.jsx'), { ssr: false, loading: () => <div style={{ position: 'fixed', inset: 0, background: '#202522' }} /> });
const LoginApp = dynamic(() => import('./LoginApp.jsx'), { ssr: false, loading: () => <div style={{ position: 'fixed', inset: 0, background: '#F4F0E6' }} /> });
const ApplyApp = dynamic(() => import('../apply/ApplyApp.jsx'), { ssr: false });

export function PortShell({ children }) { return <PortApp>{children}</PortApp>; }
export function PortLogin() { return <LoginApp />; }
export function PortApply() { return <ApplyApp />; }
