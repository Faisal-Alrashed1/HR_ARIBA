import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { toast } from '../../components/Toast.jsx';
import { payrollArchive } from '../../lib/payroll.js';
import { MN_AR, MN_EN } from '../../lib/finance.js';

const f2 = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** كارت «سجل المسيرات المعتمدة» أسفل صفحة المسير (V53 في الأصل) */
export default function PayArchive() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const [list, setList] = useState(null), [err, setErr] = useState(false), [detail, setDetail] = useState(null);
  const load = useCallback(async () => {
    setList(null); setErr(false);
    try { const d = await payrollArchive(); setList((d && d.archives) || []); } catch { setErr(true); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function open(y, m) {
    try { const d = await payrollArchive(Number(y), Number(m)); const x = ((d && d.archives) || [])[0]; if (x) setDetail({ y, m, rows: x.rows || [] }); }
    catch (e) { toast(e.message || 'تعذر فتح المسير', 'ter'); }
  }
  const mn = (m) => (en ? MN_EN : MN_AR)[Number(m)] || m;
  return (
    <div className="card" style={{ marginTop: 12 }} id="ARIBA_PAYROLL_ARCHIVE_CARD">
      <div className="ch"><div className="ct">📁 {T('سجل المسيرات المعتمدة', 'Approved Payroll History')}</div><button className="btn bpl bsm" onClick={load}>{T('تحديث', 'Refresh')}</button></div>
      <div id="ARIBA_PAYROLL_ARCHIVE" style={{ padding: 0 }}>
        {list === null ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--mu)' }}>{T('جاري تحميل سجل المسيرات المعتمدة...', 'Loading approved payroll history...')}</div>
          : err ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--rd)' }}>{T('تعذر تحميل سجل المسيرات المعتمدة', 'Unable to load payroll history')}</div>
            : !list.length ? <div style={{ padding: 22, textAlign: 'center', color: 'var(--mu)' }}>{T('لا توجد مسيرات رواتب معتمدة محفوظة حتى الآن.', 'No approved payroll history yet.')}</div>
              : list.map((x) => { let total = 0, net = 0; (x.rows || []).forEach((r) => { total += Number(r.totalDue || r.total || 0) || 0; net += Number(r.netSAR || r.net || 0) || 0; });
                return <div key={x.year + '-' + x.month} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '11px 12px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ minWidth: 150, flex: 1 }}><strong>{mn(x.month)} {x.year}</strong><div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 3 }}>{T('معتمد', 'Approved')} — {x.approved_at || ''} | {Number(x.employees || 0)} {T('موظف', 'employees')}</div></div>
                  <div className="b bgr" style={{ padding: '5px 9px' }}>{f2(total)} {T('إجمالي', 'Total')}</div>
                  <div className="b ba" style={{ padding: '5px 9px' }}>{f2(net)} SAR {T('صافي', 'Net')}</div>
                  <button className="btn bsm bpl" onClick={() => open(x.year, x.month)}>{T('مراجعة', 'Review')}</button></div>; })}
      </div>
      <div id="ARIBA_PAYROLL_ARCHIVE_DETAIL">
        {detail && <div className="card" style={{ marginTop: 10, padding: 0, overflow: 'auto' }}>
          <div className="ch"><div className="ct">📁 {T('مسير معتمد — ', 'Approved Payroll — ')}{mn(detail.m)} {detail.y}</div><button className="btn bsm" onClick={() => setDetail(null)}>{T('إغلاق', 'Close')}</button></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr><th>#</th><th>{T('الموظف', 'Employee')}</th><th>{T('العملة', 'Currency')}</th><th>{T('الإجمالي', 'Total')}</th><th>{T('الصافي المحلي', 'Net Local')}</th><th>{T('الصافي بالريال', 'Net SAR')}</th></tr></thead>
            <tbody>{detail.rows.map((r, i) => <tr key={i}><td>{r.empNo || r.employee_id || r.id || i + 1}</td><td>{en ? (r.nameEn || r.name || '—') : (r.nameAr || r.name || '—')}</td><td>{r.currency || 'ريال سعودي'}</td><td>{f2(r.totalDue || r.total)}</td><td>{f2(r.net || r.netLocal || r.netSalary)}</td><td style={{ fontWeight: 800, color: 'var(--gr)' }}>{f2(r.netSAR || r.net)} SAR</td></tr>)}</tbody></table>
        </div>}
      </div>
    </div>
  );
}
