import { DEPTS, EMPLOYERS } from './employees.js';
/** قوائم الأقسام وجهات العمل (V60): محفوظة على الجهاز (نفس مفتاح النسخة القديمة) + أي قيمة مستخدمة عند موظف */
const K = 'hr7_master_lists';
const read = () => { try { const d = JSON.parse(localStorage.getItem(K) || 'null'); if (d && Array.isArray(d.departments) && Array.isArray(d.employers)) return d; } catch { /* ignore */ } return null; };
const str = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
export function getLists(employees) {
  const d = read() || { departments: DEPTS.slice(), employers: EMPLOYERS.slice() };
  const deps = str(d.departments), emps = str(d.employers);
  (employees || []).forEach((e) => { if (e.dept && !deps.includes(e.dept)) deps.push(e.dept); if (e.employer && !emps.includes(e.employer)) emps.push(e.employer); });
  return { departments: [...new Set(deps)], employers: [...new Set(emps)] };
}
export function saveLists(l) { try { localStorage.setItem(K, JSON.stringify({ departments: str(l.departments), employers: str(l.employers) })); } catch { /* ignore */ } }
