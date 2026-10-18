import PurgeBox from './PurgeBox.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { useApp } from '../../store/AppStore.jsx';
import { MOD, modName, fv, flush, pending, auditList } from '../../lib/audit.js';
import { friendly } from '../../components/Toast.jsx';
import { saveXlsx, printOfficial, esc } from '../../lib/finance.js';

const INP = { background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 8, color: 'var(--tx)', padding: '6px 9px', fontSize: 12 };
const TD = { padding: '6px 8px', borderBottom: '1px solid rgba(36,48,68,.25)', textAlign: 'right', fontSize: 11.5, verticalAlign: 'top' };
const TH = { background: 'var(--c2)', padding: '7px 8px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, borderBottom: '2px solid var(--bl)', whiteSpace: 'nowrap' };
const riyadh = (ts, en) => { try { return new Date(ts).toLocaleString(en ? 'en-GB' : 'ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return String(ts); } };

/** جدول سجل التعديلات + طباعة/Excel — يُستخدم في الصفحة وفي نافذة سجل القسم */
export function AuditTable({ rows, en }) {
  const T = (a, b) => (en ? b : a);
  if (!rows.length) return <div style={{ padding: 28, textAlign: 'center', color: 'var(--mu)' }}>{T('لا توجد تعديلات', 'No changes')}</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{[T('الوقت', 'Time'), T('المستخدم', 'User'), T('القسم', 'Module'), T('الإجراء', 'Action'), T('التفاصيل', 'Details')].map((x) => <th key={x} style={TH}>{x}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => { const ch = r.details && r.details.changes;
        return <tr key={r.id || i}>
          <td style={{ ...TD, whiteSpace: 'nowrap', direction: 'ltr' }}>{riyadh(r.at, en)}</td>
          <td style={{ ...TD, whiteSpace: 'nowrap' }}><b>{r.actor_name || r.actor_username || '—'}</b><div style={{ fontSize: 10, color: 'var(--mu)' }}>{r.actor_username} · {r.actor_role}</div></td>
          <td style={{ ...TD, whiteSpace: 'nowrap' }}><span className="b bb" style={{ fontSize: 10 }}>{modName(r.module, en)}</span></td>
          <td style={{ ...TD, fontWeight: 700 }}>{r.action}</td>
          <td style={TD}>{r.summary}{ch && ch.length ? <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--mu)' }}>{ch.map((c, k) => <div key={k}>{c.label || c.field}: <span style={{ color: 'var(--rd)' }}>{fv(c.old, en)}</span> ← <span style={{ color: 'var(--gr)' }}>{fv(c.new, en)}</span></div>)}</div> : null}</td>
        </tr>; })}</tbody>
    </table>
  );
}
export function auditXlsx(rows, en) {
  const T = (a, b) => (en ? b : a);
  const data = [[T('سجل التعديلات', 'Audit log')], [], [T('الوقت', 'Time'), T('المستخدم', 'User'), T('الحساب', 'Account'), T('الصلاحية', 'Role'), T('القسم', 'Module'), T('الإجراء', 'Action'), T('الموظف/العنصر', 'Entity'), T('التفاصيل', 'Details'), T('التغييرات', 'Changes')]];
  rows.forEach((r) => { const ch = (r.details && r.details.changes) || []; data.push([riyadh(r.at, en), r.actor_name || '', r.actor_username || '', r.actor_role || '', modName(r.module, en), r.action, r.entity_name || '', r.summary || '', ch.map((c) => (c.label || c.field) + ': ' + fv(c.old, en) + ' ← ' + fv(c.new, en)).join(' | ')]); });
  saveXlsx('audit_log.xlsx', [{ name: T('سجل التعديلات', 'Audit log'), rows: data, widths: [20, 22, 14, 10, 18, 28, 22, 70, 60] }]);
}
export function auditPrint(rows, en, settings) {
  const T = (a, b) => (en ? b : a); const th = 'background:#014D3D;color:#fff;padding:4px;font-size:9px;border:1px solid #014D3D', td = 'padding:3px 4px;border:1px solid #d9e3df;font-size:9px;text-align:right;vertical-align:top';
  const h = '<div dir="' + (en ? 'ltr' : 'rtl') + '" style="padding:0 6mm;font-family:Tahoma,Arial,sans-serif"><div style="text-align:center;margin:2mm 0 3mm;font-size:14px;font-weight:800;color:#014D3D">' + T('سجل التعديلات', 'Audit log') + '</div><table style="width:100%;border-collapse:collapse"><thead><tr>' + [T('الوقت', 'Time'), T('المستخدم', 'User'), T('القسم', 'Module'), T('الإجراء', 'Action'), T('التفاصيل', 'Details')].map((x) => '<th style="' + th + '">' + x + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map((r) => { const ch = (r.details && r.details.changes) || []; return '<tr><td style="' + td + ';direction:ltr">' + esc(riyadh(r.at, en)) + '</td><td style="' + td + '">' + esc((r.actor_name || '') + ' (' + (r.actor_username || '') + ')') + '</td><td style="' + td + '">' + esc(modName(r.module, en)) + '</td><td style="' + td + '"><b>' + esc(r.action) + '</b></td><td style="' + td + '">' + esc(r.summary || '') + (ch.length ? '<br>' + ch.map((c) => esc((c.label || c.field) + ': ' + fv(c.old, en) + ' ← ' + fv(c.new, en))).join('<br>') : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  printOfficial(settings, T('سجل التعديلات', 'Audit log'), h, { dir: en ? 'ltr' : 'rtl', lang: en ? 'en' : 'ar' });
}

export default function Audit() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a); const { settings } = useApp();
  const [f, setF] = useState({ mod: '', user: '', from: '', to: '', q: '' }), [rows, setRows] = useState([]), [total, setTotal] = useState(0), [msg, setMsg] = useState(''), [users, setUsers] = useState({}), [loading, setLoading] = useState(false);
  const fr = useRef(f); fr.current = f;
  const go = useCallback(async () => {
    const x = fr.current; setLoading(true); setMsg('');
    await flush();
    const body = { limit: 300 }; if (x.mod) body.modules = [x.mod]; if (x.user) body.actor = x.user; if (x.q.trim()) body.q = x.q.trim();
    if (x.from) body.from = x.from + 'T00:00:00+03:00'; if (x.to) body.to = new Date(new Date(x.to + 'T00:00:00+03:00').getTime() + 86400000).toISOString();
    try {
      const r = await auditList(body); const list = (r && r.rows) || []; setRows(list); setTotal((r && r.total) || 0);
      setUsers((u) => { const n = { ...u }; list.forEach((y) => { if (y.actor_username) n[y.actor_username] = y.actor_name || y.actor_username; }); return n; });
    } catch (e) { setRows([]); setMsg(friendly(e.message || e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { go(); }, []); // eslint-disable-line
  const set = (k) => (e) => { const v = e.target.value; setF((o) => ({ ...o, [k]: v })); if (k !== 'q') setTimeout(go, 0); };
  const Lb = ({ t, children }) => <div><label style={{ fontSize: 10.5, color: 'var(--mu)', display: 'block', marginBottom: 3 }}>{t}</label>{children}</div>;
  return (
    <div style={{ padding: '4px 0' }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="ct" style={{ marginBottom: 10 }}><i className="ti ti-history" /> {T('سجل التعديلات', 'Audit log')}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Lb t={T('القسم', 'Module')}><select id="AU_MOD" style={INP} value={f.mod} onChange={set('mod')}><option value="">{T('كل الأقسام', 'All modules')}</option>{Object.keys(MOD).map((k) => <option key={k} value={k}>{modName(k, en)}</option>)}</select></Lb>
          <Lb t={T('المستخدم', 'User')}><select id="AU_USER" style={{ ...INP, minWidth: 150 }} value={f.user} onChange={set('user')}><option value="">{T('كل المستخدمين', 'All users')}</option>{Object.keys(users).map((k) => <option key={k} value={k}>{users[k]} ({k})</option>)}</select></Lb>
          <Lb t={T('من', 'From')}><input type="date" id="AU_FROM" style={INP} value={f.from} onChange={set('from')} /></Lb>
          <Lb t={T('إلى', 'To')}><input type="date" id="AU_TO" style={INP} value={f.to} onChange={set('to')} /></Lb>
          <div style={{ flex: 1, minWidth: 160 }}><Lb t={T('بحث', 'Search')}><input id="AU_Q" style={{ ...INP, width: '100%', boxSizing: 'border-box' }} value={f.q} onChange={set('q')} onKeyDown={(e) => e.key === 'Enter' && go()} /></Lb></div>
          <button className="btn bpl bsm" id="AU_GO" onClick={go}><i className="ti ti-refresh" /> {T('تحديث', 'Refresh')}</button>
          <button className="btn bgr bsm" id="AU_PR" onClick={() => auditPrint(rows, en, settings)}><i className="ti ti-printer" /></button>
          <button className="btn bgr bsm" id="AU_XL" onClick={() => auditXlsx(rows, en)}>Excel</button>
        </div>
        <div id="AU_INFO" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--mu)' }}>{loading ? T('جاري التحميل…', 'Loading…') : T('عدد التعديلات: ', 'Entries: ') + total + (total > rows.length ? ' — ' + T('معروض آخر ', 'showing latest ') + rows.length : '') + (pending() ? ' — ' + T('في الانتظار للإرسال: ', 'pending upload: ') + pending() : '')}</div>
        <PurgeBox />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto', marginTop: 12 }} id="AU_BODY">{msg ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--rd)' }}>{msg}</div> : <AuditTable rows={rows} en={en} />}</div>
    </div>
  );
}
