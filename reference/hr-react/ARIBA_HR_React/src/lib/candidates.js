import { rpc, getSetting, setSetting } from './api.js';
import { emptyForm, buildEmployee, syncEmployee } from './employees.js';

const fetchFile = async (id) => rpc('ariba_hr_candidate_file', { p_file_id: id });
const photoDataUrl = async (f) => {
  const r = await fetchFile(f.id); const src = 'data:' + r.mime + ';base64,' + r.base64;
  return new Promise((res) => { const img = new Image(); img.onerror = () => res(''); img.onload = () => { const k = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; img.src = src; });
};


/** يحوّل مرشحاً إلى موظف (بياناته + ملفاته) — v: { em, dep, jt, nature, cj, dur, sal, note } */
export async function acceptCandidate(c, v, employees) {
  const d = c.data, f = { ...emptyForm(), na: d.nameAr || '', ne: d.nameEn || '', nat: d.nationality || 'سعودي', dob: d.dob || '', mb: d.mobile || '', ml: d.email || '', bk: d.bank || '', ib: d.iban || '', iq: d.idNo || '', iqe: d.idExpiry || '', pn: d.passportNo || '', ppe: d.passportExpiry || '',
    em: v.em, dep: v.dep, jt: v.jt, contractNature: v.nature, cj: v.cj, dur: v.nature === 'fixed' ? v.dur : '', sal: parseFloat(v.sal) || 0, notes: d.notes || '' };
  const ph = c.files.find((x) => x.type === 'photo'); if (ph) f.photoData = await photoDataUrl(ph);
  const r = buildEmployee(f, null, employees); if (r.error) throw new Error(r.error);
  await syncEmployee(r.emp);
  const res = await rpc('ariba_hr_candidate_accept', { p_candidate_id: c.id, p_employee_id: String(r.emp.id), p_note: v.note || null });
  return { emp: r.emp, moved: res.moved };
}
export const AUTO_KEY = 'candidate_auto';
export const getAutoCfg = async () => { try { return (await getSetting(AUTO_KEY)) || { on: false }; } catch { return { on: false }; } };
export const setAutoCfg = (v) => setSetting(AUTO_KEY, v);
