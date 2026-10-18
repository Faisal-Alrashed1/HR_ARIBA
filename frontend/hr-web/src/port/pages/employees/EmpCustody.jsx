import { useEffect, useState } from 'react';
import { rpc } from '../../lib/api.js';
import { usePerm } from '../../store/AppStore.jsx';
import { CAT } from '../finance/Assets.jsx';
import { money } from '../../lib/finance.js';

const dmy = (s) => { const a = String(s || '').slice(0, 10).split('-'); return a.length === 3 ? a[2] + '/' + a[1] + '/' + a[0] : ''; };
const TD = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: 12 };

/** تبويب العهدة: العهدة المسجّلة على الموظف + آخر الحركات (التسليم والاستلام من صفحة الأصول والعهد) */
export default function EmpCustody({ emp }) {
  const P = usePerm(); const allowed = P.lvl('assets') !== 'none';
  const [st, setSt] = useState({ assets: [], log: [], loaded: false, err: '' });
  useEffect(() => {
    if (!allowed) return undefined; let off = false;
    rpc('ariba_assets_list', {}).then((r) => { if (!off) setSt({ assets: (r && r.assets) || [], log: (r && r.log) || [], loaded: true, err: '' }); }).catch((e) => { if (!off) setSt({ assets: [], log: [], loaded: true, err: e.message || 'تعذر التحميل' }); });
    return () => { off = true; };
  }, [allowed]);
  if (!allowed) return <div className="al alb" style={{ margin: 10 }}><i className="ti ti-lock" /> لا تملك صلاحية عرض الأصول والعهد.</div>;
  if (!emp) return <div style={{ color: 'var(--mu)', fontSize: 12, padding: 14 }}>احفظ الموظف الأول عشان تقدر تسجّل عليه عهدة.</div>;
  const keys = [String(emp.id)]; if (emp.empNo != null) keys.push(String(emp.empNo)); if (emp.username || emp.u) keys.push(String(emp.username || emp.u));
  const mine = st.assets.filter((a) => (keys.includes(String(a.custodian_employee_id)) || (emp.nameAr && a.custodian_name === emp.nameAr)) && (!a.status || a.status === 'active'));
  const hist = st.log.filter((l) => keys.includes(String(l.employee_id))).slice(0, 8);
  const nm = {}; st.assets.forEach((a) => { nm[a.id] = a.asset_no + ' — ' + a.name; });
  return (
    <div id="AS_EMPCARD" style={{ padding: 10 }}>
      <div className="ct" style={{ marginBottom: 8 }}><i className="ti ti-package" /> العهدة المسجّلة على الموظف</div>
      {mine.length ? <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
        {mine.map((a) => <tr key={a.id}><td style={{ ...TD, fontWeight: 700 }}>{a.asset_no}</td><td style={TD}>{a.name}</td><td style={TD}>{(CAT[a.category] || CAT.other)[0]}</td><td style={TD}>من {dmy(a.custody_date)}</td><td style={TD}>{money(a.cost)}</td></tr>)}
      </tbody></table> : <div style={{ color: 'var(--mu)', fontSize: 12 }}>{st.err ? st.err : st.loaded ? 'مفيش عهدة على الموظف ده' : 'جاري التحميل…'}</div>}
      {hist.length > 0 && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8 }}>آخر الحركات: {hist.map((l) => (l.action === 'assign' ? 'استلم' : 'سلّم') + ' ' + (nm[l.asset_id] || '') + ' (' + dmy(l.at_date) + ')').join(' • ')}</div>}
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>التسليم والاستلام من صفحة "الأصول والعهد".</div>
    </div>
  );
}
