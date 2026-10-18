import { rpc, getSetting, setSetting } from './api.js';

/** يحوّل مرشحاً إلى موظف (بياناته + ملفاته) — v: { em, dep, jt, nature, cj, dur, sal, note }
 *  ADAPTED: the server builds the employee with the same rules (their buildEmployee, backend employees_port.py),
 *  moves the photo and the files and links the candidate in one step. */
export async function acceptCandidate(c, v) {
  const res = await rpc('ariba_hr_candidate_accept', { p_candidate_id: c.id, p_values: v });
  return { emp: res.emp, moved: res.moved };
}
export const AUTO_KEY = 'candidate_auto';
export const getAutoCfg = async () => { try { return (await getSetting(AUTO_KEY)) || { on: false }; } catch { return { on: false }; } };
export const setAutoCfg = (v) => setSetting(AUTO_KEY, v);
