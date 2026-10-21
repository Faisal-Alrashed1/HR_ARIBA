import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fD } from '../../lib/util.js';
import { toast } from '../../components/Toast.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { LVL, lvl, recordLeave, deleteLeave, fetchRequests, getDocFile, saveFile } from '../../lib/leaves.js';
import { listLeaveFiles, getLeaveFile, deleteLeaveFiles, migrateLocalAtts } from '../../lib/leaveFiles.js';
import DocPreview, { fmtSize } from '../../components/DocPreview.jsx';
import { leaveRequestDays, annualLeaveNetDays } from '../../engines/leave.js';
const refundNote = (l) => { if (l.type !== 'annual' || l.status !== 'approved') return null; let r = null; try { r = annualLeaveNetDays(l); } catch { return null; } if (!r || !r.refunded) return null; return <div style={{ fontSize: 10.5, color: '#0a7a3f', fontWeight: 700 }} title="أيام اتشالت من السنوية لأنها مغطاة بإجازة أخرى معتمدة">⤺ {r.days} فعلي — رُدّ {r.refunded} ({Object.entries(r.byType).map(([k, n]) => (LVL[k] ? LVL[k].ar : k) + ' ' + n).join('، ')})</div>; };

export default function AllRequests() {
  const h = useLang() === 'en';
  const { employees, leaves, reload } = useApp();
  const can = usePerm().edit('leaves');
  const [ef, setEf] = useState(''); const [tf, setTf] = useState(''); const [sf, setSf] = useState('');
  const [rtf, setRtf] = useState(''); const [del, setDel] = useState(null); const [cloud, setCloud] = useState([]); const [local, setLocal] = useState([]); const [prev, setPrev] = useState(null); const [spin, setSpin] = useState(false);
  const loadAtts = useCallback(async () => { setSpin(true); try { setCloud(await fetchRequests()); } catch { setCloud([]); } try { await migrateLocalAtts(leaves); } catch { /* */ } try { setLocal(await listLeaveFiles()); } catch { setLocal([]); } setSpin(false); }, [leaves]);
  useEffect(() => { loadAtts(); }, [loadAtts]);
  const nameOf = (id) => { const e = employees.find((x) => String(x.id) === String(id)); return e ? String(h ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn) || '').split(' ').slice(0, 3).join(' ') : '—'; };
  const stLbl = (v) => ({ pending: h ? 'Pending' : 'معلق', approved: h ? 'Approved' : 'موافق', rejected: h ? 'Rejected' : 'مرفوض' }[String(v || 'pending').toLowerCase()] || v);
  const tyLbl = (t, p) => { const v = lvl(t); if (String(t || '').startsWith('template:')) return '📄 ' + ((p && p.title) || (h ? 'Document' : 'مستند')); return v ? (h ? v.en : v.ar) : ({ forgot_punch: 'نسيان بصمة', overtime: 'عمل إضافي' }[t] || t); };
  const archive = useMemo(() => {
    const rows = [];
    cloud.forEach((x) => (x.attachments || []).forEach((a) => rows.push({ key: 'c' + a.id, emp: (x.employee && (h ? x.employee.nameEn || x.employee.nameAr : x.employee.nameAr || x.employee.nameEn)) ? String(h ? x.employee.nameEn || x.employee.nameAr : x.employee.nameAr || x.employee.nameEn).split(' ').slice(0, 3).join(' ') : nameOf((x.request || {}).employee_id), type: tyLbl((x.request || {}).request_type, (x.request || {}).payload), status: stLbl((x.request || {}).status), name: a.file_name || '', size: a.file_size, at: String(a.created_at || '').slice(0, 10), get: () => getDocFile(a.id) })));
    local.forEach((a) => { const l = leaves.find((q) => String(q.id) === String(a.leave_id)); if (!l) return; rows.push({ key: 'l' + a.id, emp: nameOf(l.empId), type: tyLbl(l.type), status: stLbl(l.status), name: a.file_name || '', size: a.file_size, at: String(a.created_at || l.from || '').slice(0, 10), get: () => getLeaveFile(a.id) }); });
    return rows.sort((p, q) => String(q.at).localeCompare(String(p.at)));
  }, [cloud, local, leaves, employees, h]); // eslint-disable-line
  // every request of every type (leave, permission, advance, forgot punch, profile edit, IBAN change, document, overtime, forms) with its stage and rejection reason — /staff/requests
  const STG = { manager: ['Direct Manager', 'المدير المباشر'], hr: ['HR', 'الموارد البشرية'], ceo: ['CEO', 'الرئيس التنفيذي'] };
  const detailOf = (r) => { const p = r.payload || {}; const t = r.request_type; const fn = (v) => Number(v).toLocaleString('en-US');
    if (t === 'iban_change') return `IBAN: ${p.iban || ''} | ${p.bank || ''}${p.account_no ? ' | ' + (h ? 'Account ' : 'حساب ') + p.account_no : ''}`;
    if (t === 'profile_edit') return Object.keys(p.changes || {}).map((k) => `${k}: ${(p.old || {})[k] || '—'} ← ${p.changes[k]}`).join(' | ');
    if (t === 'document') return p.doc_label || '';
    if (t === 'forgot_punch') return `${({ in: h ? 'Check-in' : 'دخول', out: h ? 'Check-out' : 'خروج', both: h ? 'Check-in & out' : 'دخول وخروج' })[p.kind] || ''} ${p.date || ''} ${String(p.time || '').slice(0, 5)}${p.kind === 'both' && p.time2 ? ' → ' + String(p.time2).slice(0, 5) : ''}`.trim();
    if (String(t || '').startsWith('template:')) return p.title || '';
    if (p.from) return `${fD(p.from)} ← ${fD(p.to || p.from)} | ${p.days || 0} ${h ? 'days' : 'يوم'}`;
    return `${p.date ? fD(p.date) : ''}${p.time ? ' ' + String(p.time).slice(0, 5) : ''}${(p.hours || p.dur) ? ' | ' + (p.hours || p.dur) + (h ? ' h' : ' ساعة') : ''}${p.amount ? ' | ' + fn(p.amount) + ' SAR' : ''}`.trim().replace(/^\|\s*/, ''); };
  const allReqs = useMemo(() => cloud.map((x) => ({ r: x.request || {}, e: x.employee || {}, n: (x.attachments || []).length }))
    .filter(({ r }) => r.request_type && (!ef || String(r.employee_id) === String(ef)) && (!sf || r.status === sf) && (!rtf || tyLbl(r.request_type, r.payload) === rtf))
    .sort((a, b) => String(b.r.created_at || '').localeCompare(String(a.r.created_at || ''))), [cloud, ef, sf, rtf, h]); // eslint-disable-line
  const reqTypes = useMemo(() => [...new Set(cloud.map((x) => x.request || {}).filter((r) => r.request_type).map((r) => tyLbl(r.request_type, r.payload)))].sort(), [cloud]); // eslint-disable-line
  const view = async (r) => { try { setPrev(await r.get()); } catch (e) { toast(e.message || 'تعذر فتح المرفق', 'ter'); } };
  const dl = async (r) => { try { saveFile(await r.get()); } catch (e) { toast(e.message || 'تعذر التحميل', 'ter'); } };
  const list = useMemo(() => leaves.filter((l) => (!ef || l.empId === ef) && (!tf || l.type === tf) && (!sf || l.status === sf))
    .sort((a, b) => new Date(b.from || 0) - new Date(a.from || 0) || b.ts - a.ts), [leaves, ef, tf, sf]);
  const stB = { pending: <span className="b ba">{h ? 'Pending' : 'معلق'}</span>, approved: <span className="b bg">{h ? 'Approved' : 'موافق'}</span>, rejected: <span className="b br">{h ? 'Rejected' : 'مرفوض'}</span> };
  async function run(fn, ok) { try { await fn(); toast(ok); await reload({ silent: true }); } catch (e) { toast(e.message || 'تعذر التنفيذ', 'ter'); } }
  return (
    <div id="lv2"><div className="card">
      <div className="sbar">
        <select value={ef} onChange={(e) => setEf(e.target.value)} style={{ maxWidth: 160 }}><option value="">كل الموظفين</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.nameAr}</option>)}</select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} style={{ maxWidth: 150 }}><option value="">كل الأنواع</option>{Object.entries(LVL).filter(([k]) => !['perm', 'perm_mat', 'early_leave', 'advance', 'overtime', 'mission'].includes(k)).map(([k, v]) => <option key={k} value={k}>{h ? v.en : v.ar}</option>)}</select>
        <select value={sf} onChange={(e) => setSf(e.target.value)} style={{ maxWidth: 130 }}><option value="">كل الحالات</option><option value="pending">معلق</option><option value="approved">موافق</option><option value="rejected">مرفوض</option></select>
        <button type="button" className="btn bpl bsm" id="LV_SEARCH" title={h ? 'Refresh' : 'تحديث / بحث'} disabled={spin} onClick={async () => { await reload({ silent: true }); await loadAtts(); }}><i className="ti ti-search" /></button>
      </div>
      <div className="tw"><table><tbody>
        <tr>{(h ? ['Employee', 'Type', 'From', 'To', 'Days', 'Status', 'Action'] : ['الموظف', 'النوع', 'من', 'إلى', 'الأيام', 'الحالة', 'إجراء']).map((t) => <th key={t}>{t}</th>)}</tr>
        {list.map((l) => { const e = employees.find((x) => String(x.id) === l.empId); const lt = LVL[l.type] || { ar: l.type, en: l.type }; return (
          <tr key={l.id}><td style={{ fontWeight: 600 }}>{e ? String(e.nameAr || '').split(' ').slice(0, 3).join(' ') : '—'}</td><td>{h ? lt.en : lt.ar}</td><td>{fD(l.from)}</td><td>{fD(l.to)}</td><td>{leaveRequestDays(l)}{refundNote(l)}</td><td>{stB[l.status]}</td>
            <td>{can && l.hr && <>
              {l.status === 'pending' && <button className="btn bgl bsm" onClick={() => run(() => recordLeave({ ...l, days: leaveRequestDays(l) }, 'approved'), '✓ تمت الموافقة')}>✓</button>}{' '}
              {l.status !== 'pending' && <button className="btn bsm" title="تراجع عن القرار: إعادة الطلب لمعلق (أو احذفه بزر الحذف)" onClick={() => run(() => recordLeave({ ...l, days: leaveRequestDays(l) }, 'pending'), '↩ أُعيد الطلب لحالة معلق')}>↩</button>}{' '}
              <button className="btn bsm" style={{ color: 'var(--rd)', opacity: 0.8 }} title="حذف" onClick={() => setDel(l)}><i className="ti ti-trash" /></button></>}</td></tr>); })}
        {!list.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mu)', padding: 22 }}>لا توجد طلبات</td></tr>}
      </tbody></table></div>
      {prev && <DocPreview file={prev} onClose={() => setPrev(null)} onDownload={() => saveFile(prev)} />}
      <PromptModal open={!!del} noInput title="حذف إجازة" message="حذف هذا السجل نهائياً (يختفي من تطبيق الموظف أيضاً)؟" danger confirmText="حذف" onClose={() => setDel(null)} onConfirm={() => { const l = del; setDel(null); run(async () => { await deleteLeave(l.id); try { await deleteLeaveFiles(l.id); } catch { /* */ } }, 'تم الحذف'); }} />
    </div>
    <div className="card" id="ariba-all-req-log" style={{ marginTop: 12 }}>
      <div className="ct" style={{ padding: '10px 12px' }}><i className="ti ti-list-details" /> {h ? 'All requests log (every type and status)' : 'سجل كل الطلبات (كل الأنواع والحالات)'} <span className="b ba">{allReqs.length}</span>
        <select value={rtf} onChange={(e) => setRtf(e.target.value)} style={{ maxWidth: 170, marginInlineStart: 10 }}><option value="">{h ? 'All types' : 'كل الأنواع'}</option>{reqTypes.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
      <div className="tw"><table><tbody>
        <tr>{(h ? ['Employee', 'Type', 'Details', 'Status', 'Stage / reason', 'Date', 'Files'] : ['الموظف', 'النوع', 'التفاصيل', 'الحالة', 'المرحلة / السبب', 'التاريخ', 'مرفقات']).map((t) => <th key={t}>{t}</th>)}</tr>
        {allReqs.map(({ r, e, n }) => <tr key={r.id}><td style={{ fontWeight: 600 }}>{String((h ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || nameOf(r.employee_id)).split(' ').slice(0, 3).join(' ')}</td><td>{tyLbl(r.request_type, r.payload)}</td><td style={{ fontSize: 11 }}>{detailOf(r)}{(r.payload || {}).notes ? <div style={{ color: 'var(--mu)' }}>{r.payload.notes}</div> : null}</td><td>{stB[r.status] || r.status}</td>
          <td style={{ fontSize: 11 }}>{r.status === 'rejected' ? <span style={{ color: 'var(--rd)' }}>{r.reject_reason || '—'}</span> : r.status === 'pending' ? (STG[r.current_stage] ? STG[r.current_stage][h ? 0 : 1] : '—') : '—'}</td><td>{String(r.created_at || '').slice(0, 10)}</td><td>{n || ''}</td></tr>)}
        {!allReqs.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--mu)', padding: 22 }}>{h ? 'No requests' : 'لا توجد طلبات'}</td></tr>}
      </tbody></table></div>
    </div>
    {archive.length > 0 && <div className="card" id="ariba117Atts" style={{ marginTop: 12 }}>
      <div className="ct" style={{ padding: '10px 12px' }}><i className="ti ti-paperclip" /> {h ? 'Request attachments archive (all statuses)' : 'أرشيف مرفقات الطلبات (كل الحالات)'}</div>
      <div className="tw"><table><tbody>
        <tr>{(h ? ['Employee', 'Request', 'Status', 'File', 'Size', 'Date', ''] : ['الموظف', 'نوع الطلب', 'حالة الطلب', 'الملف', 'الحجم', 'التاريخ', '']).map((t, i) => <th key={i}>{t}</th>)}</tr>
        {archive.map((r) => <tr key={r.key}><td>{r.emp}</td><td>{r.type}</td><td>{r.status}</td><td>{r.name}</td><td>{fmtSize(r.size)}</td><td>{r.at}</td>
          <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="btn bpl bsm" data-view={r.key} onClick={() => view(r)}>{h ? 'View' : 'عرض'}</button> <button type="button" className="btn bsm" onClick={() => dl(r)}>{h ? 'Download' : 'تحميل'}</button></td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}
