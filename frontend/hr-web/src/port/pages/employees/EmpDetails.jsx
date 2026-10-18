import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { useApp } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { fN, fD } from '../../lib/util.js';
import { calcIns, calcEOS } from '../../engines/insurance.js';
import { insExempt } from '../../engines/empkind.js';
import { salaryUnit } from '../../lib/employees.js';
import { leaveCurrentBalance } from '../../engines/leave.js';
import { Av, grossDisplay, netSAR } from './EmpList.jsx';

const Di = ({ l, v }) => <div className="di"><div className="dl">{l}</div><div className="dv">{v === undefined || v === null || v === '' ? '—' : v}</div></div>;

export default function EmpDetails({ id, onClose }) {
  const h = useLang() === 'en';
  const { employees } = useApp();
  const [tab, setTab] = useState(0);
  const e = id ? employees.find((x) => x.id === id) : null;
  if (!e) return null;
  const name = h ? (e.nameEn || e.nameAr || '—') : (e.nameAr || e.nameEn || '—');
  const u = salaryUnit(e); const c = calcIns(e, 31, 31); const exempt = insExempt(e);
  const days = (d) => (d || 9999) < 9999 ? d + (h ? ' days' : ' يوم') : '—';
  const yr = (y) => ((e.leaveYearOverrides && e.leaveYearOverrides[y] && e.leaveYearOverrides[y].used) || 0) + (h ? ' days' : ' يوم');
  const T = [h ? 'Basic' : 'أساسي', h ? 'Docs' : 'وثائق', h ? 'Finance' : 'مالية', h ? 'Leaves' : 'إجازات'];
  const panes = [
    <>
      <Di l={h ? 'Employer' : 'جهة العمل'} v={e.employer} /><Di l={h ? 'Sponsor' : 'الكفيل'} v={e.sponsor} /><Di l={h ? 'Nationality' : 'الجنسية'} v={e.nationality} />
      <Di l={h ? 'Dept' : 'القسم'} v={e.dept} /><Di l={h ? 'Job Title' : 'الوظيفة'} v={e.jobTitle} /><Di l={h ? 'Gender' : 'الجنس'} v={e.gender} />
      <Di l={h ? 'Date of Birth' : 'تاريخ الميلاد'} v={e.dob ? fD(e.dob) : '—'} /><Di l={h ? 'Mobile' : 'الجوال'} v={e.mobile} /><Di l={h ? 'Email' : 'البريد الإلكتروني'} v={e.email} />
      <Di l={h ? 'Bank' : 'البنك'} v={e.bank} /><Di l="IBAN" v={e.iban} /><Di l={h ? 'Service' : 'سنوات الخدمة'} v={e.yearsOfService > 0 ? e.yearsOfService.toFixed(2) + (h ? ' yr' : ' سنة') : '—'} />
      <Di l={h ? 'Employee No.' : 'الرقم الوظيفي'} v={e.empNo || e.id} /><Di l={h ? 'Username' : 'اسم المستخدم'} v={e.username} />
    </>,
    <>
      <Di l={h ? 'Iqama No' : 'رقم الإقامة'} v={e.iqamaNo} /><Di l={h ? 'Iqama Exp' : 'انتهاء الإقامة'} v={fD(e.iqamaExpiry)} /><Di l={h ? 'Iqama Left' : 'متبقي إقامة'} v={days(e.iqamaDaysLeft)} />
      <Di l={h ? 'Passport No' : 'رقم الجواز'} v={e.passportNo} /><Di l={h ? 'Passport Exp' : 'انتهاء الجواز'} v={fD(e.passportExpiry)} /><Di l={h ? 'PP Left' : 'متبقي جواز'} v={days(e.passportDaysLeft)} />
      <Di l={h ? 'Insurance Co' : 'شركة التأمين'} v={e.insuranceCo} /><Di l={h ? 'Class' : 'الفئة'} v={e.insuranceClass} /><Di l={h ? 'Insurance Exp' : 'انتهاء التأمين'} v={fD(e.insuranceExpiry)} />
    </>,
    <>
      <Di l={h ? 'Basic' : 'الراتب الأساسي'} v={fN(e.salary) + ' ' + u} /><Di l={h ? 'Housing' : 'بدل السكن'} v={fN(e.housingAllowance) + ' ' + u} /><Di l={h ? 'Transport' : 'بدل النقل'} v={fN(e.transportAllowance) + ' ' + u} />
      <Di l={h ? 'Project' : 'بدل المشروع'} v={fN(e.projectAllowance) + ' ' + u} /><Di l={h ? 'Other' : 'بدلات أخرى'} v={fN(e.otherAllowance || 0) + ' ' + u} />
      <Di l={h ? 'Total / Gross' : 'الإجمالي'} v={<strong style={{ color: 'var(--gr)' }}>{grossDisplay(e)}</strong>} />
      <Di l={h ? 'Emp Insurance' : 'تأمين موظف'} v={!exempt && c.empAmt > 0 ? '-' + fN(c.empAmt) + ' ر.س' : (h ? 'None' : 'لا يوجد')} />
      <Di l={h ? 'Co Insurance' : 'تأمين شركة'} v={fN(c.erAmt) + ' ر.س'} />
      <Di l={h ? 'Net Salary / SAR' : 'الصافي / ريال'} v={<strong style={{ color: 'var(--cy)' }}>{netSAR(e)}</strong>} />
      <Di l={h ? 'EOS (calculated)' : 'مكافأة الخدمة'} v={Math.round(calcEOS(e.salary || 0, e.yearsOfService || 0, e.housingAllowance || 0)).toLocaleString('en-US') + ' ر.س'} />
    </>,
    <>
      <Di l={h ? 'Leave Balance' : 'رصيد الإجازة'} v={(() => { try { return leaveCurrentBalance(e); } catch { return e.leaveBalance || 0; } })().toFixed(1) + (h ? ' days' : ' يوم')} /><Di l={h ? 'Annual Entitlement' : 'المستحق سنوياً'} v={(e.leaveDaysContract || 21) + (h ? ' days' : ' يوم')} />
      {['2023', '2024', '2025', '2026'].map((y) => <Di key={y} l={y} v={yr(y)} />)}
      <Di l={h ? 'Start Date' : 'تاريخ المباشرة'} v={fD(e.contractJoin)} /><Di l={h ? 'Contract End' : 'انتهاء العقد'} v={e.contractEnd ? fD(e.contractEnd) : (h ? 'Open' : 'مفتوح')} /><Di l={h ? 'Contract Type' : 'نوع العقد'} v={e.contractType || '—'} />
    </>,
  ];
  const title = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{e.photoUrl && String(e.photoUrl).startsWith('data:image') && <img src={e.photoUrl} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bd)' }} />}<Av name={name} size={32} /> <span>{name}</span></span>;
  return (
    <Modal open onClose={() => { setTab(0); onClose(); }} title={title} width={740}>
      <div className="tbar">{T.map((t, i) => <div key={t} className={'tab' + (tab === i ? ' on' : '')} onClick={() => setTab(i)}>{t}</div>)}</div>
      <div className="dg" style={{ display: 'grid' }}>{panes[tab]}</div>
    </Modal>
  );
}
