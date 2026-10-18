// ADAPTED (not in their source): one Next.js page per screen of theirs (their pages/registry.js), loaded in the browser
// only (their screens use window, localStorage and the runtime the store fills).
'use client';
import dynamic from 'next/dynamic';

const wait = () => <div className="pg on" style={{ padding: 20 }}>…</div>;
export const portPage = (loader) => dynamic(loader, { ssr: false, loading: wait });
