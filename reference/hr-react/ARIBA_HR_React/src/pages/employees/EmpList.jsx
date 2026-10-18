import { getLists } from '../../lib/masterLists.js';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fN, ini, isSaudiEmp } from '../../lib/util.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import { salaryUnit, deleteEmployee, terminateEmployee, syncEmployee, EMPLOYERS } from '../../lib/employees.js';
import EmpDetails from './EmpDetails.jsx';
import Import from './Import.jsx';
import { tod } from '../../lib/util.js';

const CATS = [['all', 'الكل', 'All'], ['active', 'الموظفون الحاليون', 'Current'], ['term', 'المنتهية خدماتهم', 'Terminated'], ['tamheer', 'تمهير', 'Tamheer'], ['training', 'تدريب', 'Training'], ['consultant', 'استشاريين', 'Consultants']];

function kinds(e) {
  const w = String(e.wpsType || '').toLowerCase(), et = String(e.empType || '').toLowerCase(), jt = String(e.jobTitle || '').toLowerCase(), dp = String(e.dept || e.department || '').toLowerCase();
  return {
    tamheer: w.includes('tamheer') || et.includes('tamheer') || w.includes('تمهير') || et.includes('تمهير') || jt.includes('تمهير') || jt.includes('tamheer'),
    training: w.includes('trainee') || w.includes('training') || et.includes('trainee') || et.includes('training') || w.includes('متدرب') || et.includes('متدرب') || dp.includes('تدريب') || jt.includes('تدريب') || jt.includes('متدرب'),
    consult: w.includes('consult') || et.includes('consult') || jt.includes('استشاري') || jt.includes('consult'),
  };
}
const colorFor = (() => { const m = {}; let i = 0; const P = ['#014D3D', '#29B35E']; return (n) => { if (!m[n]) { m[n] = P[i % P.length]; i += 1; } return m[n]; }; })();
export function Av({ name, size = 30 }) { const c = colorFor(name); return <div className="av" style={{ width: size, height: size, background: c + '22', color: c, fontSize: Math.round(size * 0.34) }}>{ini(name)}</div>; }
export function DBadge({ d }) {
  if (!d || d >= 9999) return <span className="b bk">—</span>;
  if (d <= 0) return <span className="b br">منتهي</span>;
  return <span className={'b ' + (d <= 30 ? 'br' : d <= 90 ? 'ba' : 'bg')}>{d}ي</span>;
}
const grossDisplay = (e) => (e && e.salaryTotal > 0 ? fN(e.salaryTotal) + ' ' + salaryUnit(e) : '—');
const netSAR = (e) => { const v = Number(e.netSalaryLocal ?? e.netSalary) || 0; const r = e.currency === 'ريال سعودي' ? 1 : (Number(e.exchRate) > 0 ? Number(e.exchRate) : 1); return v ? (v * r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' SAR' : '—'; };
export { grossDisplay, netSAR };

export default function EmpList() {
  const h = useLang() === 'en';
  const nav = useNavigate();
  const { employees, setEmployees, reload } = useApp();
  const perm = usePerm();
  const canEdit = perm.edit('employees_admin') || perm.edit('employees');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [ef, setEf] = useState('');
  const [view, setView] = useState(null);
  const [term, setTerm] = useState(null); // {id, reason, last}
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(false);

  const employers = useMemo(() => getLists(employees).employers, [employees]);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return employees.filter((e) => {
      const k = kinds(e);
      if (cat === 'active' && (e.isHourly || e.isTerminated || k.tamheer || k.training || k.consult)) return false;
      if (cat === 'term' && !e.isTerminated) return false;
      if (cat === 'tamheer' && !k.tamheer) return false;
      if (cat === 'training' && !k.training) return false;
      if (cat === 'consultant' && !k.consult) return false;
      if (cat === 'saudi' && (e.isTerminated || !isSaudiEmp(e))) return false;
      if (cat === 'expats' && (e.isTerminated || isSaudiEmp(e))) return false;
      if (cat === 'excl' && !(e.isHourly || e.excludeFromPayroll || e.excludeFromEOS === true || e.excludedFromPayroll)) return false;
      if (ef && e.employer !== ef) return false;
      if (s && !(e.nameAr || '').toLowerCase().includes(s) && !(e.nameEn || '').toLowerCase().includes(s) && !(e.iqamaNo || '').includes(q) && !String(e.id).includes(q) && !String(e.empNo || '').includes(q)) return false;
      return true;
    });
  }, [employees, cat, q, ef]);

  async function run(fn, okMsg) {
    setBusy(true);
    try { await fn(); toast(okMsg); await reload({ silent: true }); } catch (e) { toast('تعذر تنفيذ العملية: ' + (e.message || e), 'ter'); } finally { setBusy(false); }
  }
  const doTerm = () => {
    if (!term.reason.trim()) return toast('سبب إنهاء الخدمة مطلوب', 'ter');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(term.last)) return toast('تاريخ آخر يوم عمل غير صحيح.', 'ter');
    const id = term.id; const { reason, last } = term; setTerm(null);
    run(() => terminateEmployee(id, reason.trim(), last), h ? 'Employee terminated' : 'تم إنهاء الخدمة');
  };
  const doReinstate = (e) => {
    const n = { ...e, isTerminated: false, term: false, terminationReason: '', lastDay: '' };
    if (e.contractNature === 'indefinite' && e.contractEnd === e.lastDay) { n.contractEnd = ''; n.contractDaysLeft = 9999; }
    run(() => syncEmployee(n), h ? '✓ Employee reinstated' : '✓ تم إعادة تفعيل الموظف');
  };
  const doDel = () => { const id = del.id; setDel(null); run(() => deleteEmployee(id), 'تم حذف الموظف'); };

  return (
    <div className="pg on">
      <div className="tbar" id="empCategoryTabs">
        {CATS.map(([k, ar, en]) => <div key={k} className={'tab' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{h ? en : ar}</div>)}
      </div>
      <div className="sbar">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث / Search..." style={{ maxWidth: 230 }} aria-label="search" />
        <select value={ef} onChange={(e) => setEf(e.target.value)}><option value="">كل جهات العمل</option>{employers.map((x) => <option key={x}>{x}</option>)}</select>
        {canEdit && <button className="btn bpl bsm" onClick={() => nav('/emps/new')}><i className="ti ti-plus" /> <span>{h ? 'Add Employee' : 'إضافة موظف'}</span></button>}
        {canEdit && <button className="btn bsm" id="EI_OPEN" onClick={() => setImp(true)}><i className="ti ti-file-import" /> <span>{h ? 'Import from Excel' : 'استيراد من Excel'}</span></button>}
      </div>
      <div className="card" style={{ padding: 0 }}><div className="tw"><table id="ET"><tbody>
        <tr>{(h ? ['#', 'Employee', 'Job', 'Employer', 'Dept', 'Nationality', 'Service', 'Iqama', 'Contract', 'Total Salary', 'Net', 'Actions'] : ['#', 'الموظف', 'الوظيفة', 'جهة العمل', 'القسم', 'الجنسية', 'الخدمة', 'الإقامة', 'العقد', 'الراتب الإجمالي', 'الصافي', 'إجراءات']).map((t) => <th key={t}>{t}</th>)}</tr>
        {list.map((e) => {
          const name = h ? (e.nameEn || e.nameAr || '—') : (e.nameAr || e.nameEn || '—');
          return (
            <tr key={e.id}>
              <td style={{ color: 'var(--dm)', fontWeight: 700 }}>{e.empNo || e.id}</td>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Av name={name} size={28} />
                <div><div style={{ fontWeight: 600 }}>{name}</div><div style={{ fontSize: 10, color: 'var(--dm)' }}>رقم وظيفي: {e.empNo || e.id}</div>
                  {e.isTerminated && <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 6px', borderRadius: 6, background: '#f3e9d0', color: 'var(--ariba-dark,#014D3D)', fontSize: 9, fontWeight: 800 }}>منتهية الخدمة</span>}</div></div></td>
              <td style={{ color: 'var(--mu)' }}>{e.jobTitle || '—'}</td>
              <td><span className="b bb">{e.employer}</span></td>
              <td>{e.dept || '—'}</td><td>{e.nationality || '—'}</td>
              <td>{e.yearsOfService > 0 ? e.yearsOfService.toFixed(1) + (h ? ' yr' : ' سنة') : '—'}</td>
              <td><DBadge d={e.iqamaDaysLeft || 9999} /></td><td><DBadge d={e.contractDaysLeft || 9999} /></td>
              <td style={{ color: 'var(--gr)', fontWeight: 600 }}>{grossDisplay(e)}{e.currency && e.currency !== 'ريال سعودي' && <div style={{ fontSize: 9, color: 'var(--mu)' }}>{netSAR({ ...e, netSalaryLocal: e.salaryTotal })}</div>}</td>
              <td style={{ color: 'var(--cy)', fontWeight: 600 }}>{netSAR(e)}</td>
              <td>
                <button className="btn bsm" title="عرض" onClick={() => setView(e.id)}><i className="ti ti-eye" /></button>{' '}
                {canEdit && <>
                  <button className="btn bsm" title="تعديل" onClick={() => nav('/emps/' + encodeURIComponent(e.id) + '/edit')}><i className="ti ti-edit" /></button>{' '}
                  <button className="btn bsm" style={{ color: 'var(--rd)', opacity: 0.7 }} title="حذف" disabled={busy} onClick={() => setDel({ id: e.id, name })}><i className="ti ti-trash" /></button>{' '}
                  {!e.isTerminated
                    ? <button className="btn bsm" style={{ color: 'var(--rd)' }} title="إنهاء خدمة" disabled={busy} onClick={() => setTerm({ id: e.id, name, reason: '', last: tod() })}><i className="ti ti-user-off" /></button>
                    : <button className="btn bsm" style={{ color: 'var(--gr)' }} title="إعادة تفعيل" disabled={busy} onClick={() => doReinstate(e)}><i className="ti ti-rotate-clockwise" /></button>}
                </>}
              </td>
            </tr>
          );
        })}
        {!list.length && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--mu)', padding: 24 }}>لا يوجد موظفون</td></tr>}
      </tbody></table></div></div>

      <EmpDetails id={view} onClose={() => setView(null)} />

      <Import open={imp} onClose={() => setImp(false)} />
      <Modal open={!!term} onClose={() => setTerm(null)} title={'إنهاء خدمة: ' + (term ? term.name : '')} width={420}>
        {term && <div className="fg">
          <div className="ff"><label>سبب إنهاء الخدمة</label><input autoFocus value={term.reason} onChange={(e) => setTerm({ ...term, reason: e.target.value })} /></div>
          <div className="ff"><label>آخر يوم عمل</label><input type="date" value={term.last} onChange={(e) => setTerm({ ...term, last: e.target.value })} /></div>
          <div className="ff" style={{ display: 'flex', gap: 8 }}><button className="btn bpl" onClick={doTerm}>تأكيد</button><button className="btn" onClick={() => setTerm(null)}>إلغاء</button></div>
        </div>}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="حذف موظف" width={420}>
        {del && <div>
          <p style={{ margin: '0 0 12px' }}>هل تريد حذف <b>{del.name}</b> نهائياً؟ سيُحفظ في أرشيف إنهاء الخدمة على السيرفر.</p>
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" style={{ background: 'var(--rd)', color: '#fff' }} onClick={doDel}>حذف</button><button className="btn" onClick={() => setDel(null)}>إلغاء</button></div>
        </div>}
      </Modal>
    </div>
  );
}
