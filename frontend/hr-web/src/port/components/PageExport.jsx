import { useState } from 'react';
import { tablesFrom } from '../lib/exporter.js';
import { toast } from './Toast.jsx';
import ExportDialog from './ExportDialog.jsx';

/** زر تصدير عام: يلتقط أي جدول معروض في الصفحة الحالية ويصدّره Excel / PDF / Word أو يرسله بالإيميل */
export default function PageExport({ title }) {
  const [specs, setSpecs] = useState(null), [cur, setCur] = useState(null);
  const open = () => {
    const t = tablesFrom(document.querySelector('.con')).filter((x) => x.rows.length);
    if (!t.length) return toast('لا يوجد جدول معروض في هذه الصفحة للتصدير', 'ter');
    const all = t.map((x, i) => ({ ...x, title: x.title || title, name: (title || 'page') + '_' + (i + 1), sub: new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn') }));
    if (all.length === 1) setCur(all[0]); else setSpecs(all);
  };
  return (
    <>
      <button className="ib" id="PAGE_EXPORT" onClick={open} title="تصدير هذه الصفحة (Excel / PDF / Word / إيميل)"><i className="ti ti-file-export" /></button>
      {specs && !cur && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSpecs(null)}>
          <div className="card" style={{ minWidth: 320, maxWidth: 520, padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <div className="ct" style={{ marginBottom: 8 }}>اختر الجدول المراد تصديره</div>
            {specs.map((s, i) => <button key={i} className="btn" style={{ display: 'block', width: '100%', textAlign: 'start', marginBottom: 6 }} onClick={() => { setCur(s); setSpecs(null); }}>{s.title} <span style={{ color: 'var(--mu)', fontSize: 10 }}>({s.rows.length})</span></button>)}
          </div>
        </div>)}
      {cur && <ExportDialog open onClose={() => setCur(null)} spec={cur} />}
    </>
  );
}
