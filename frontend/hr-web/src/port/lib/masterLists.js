// ADAPTED (decision 3): the lists live on the server (ariba_app_settings 'master_lists'), loaded with the other settings
// (data.js fetchSettings) — not in this browser's localStorage. Same functions as theirs.
import { DEPTS, EMPLOYERS } from './employees.js';
import { setSetting } from './api.js';
/** قوائم الأقسام وجهات العمل (V60) + أي قيمة مستخدمة عند موظف */
let cache = null;
export function setListsCache(d) { cache = d && Array.isArray(d.departments) && Array.isArray(d.employers) ? d : null; }
const str = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
export function getLists(employees) {
  const d = cache || { departments: DEPTS.slice(), employers: EMPLOYERS.slice() };
  const deps = str(d.departments), emps = str(d.employers);
  (employees || []).forEach((e) => { if (e.dept && !deps.includes(e.dept)) deps.push(e.dept); if (e.employer && !emps.includes(e.employer)) emps.push(e.employer); });
  return { departments: [...new Set(deps)], employers: [...new Set(emps)] };
}
export function saveLists(l) { const v = { departments: str(l.departments), employers: str(l.employers) }; cache = v; setSetting('master_lists', v).catch(() => {}); }
