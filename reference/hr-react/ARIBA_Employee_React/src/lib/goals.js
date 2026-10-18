import { rpc } from './api.js';

export const PT = { annual: 'سنوي', quarterly: 'ربع سنوي', monthly: 'شهري' };
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const curKey = (type, d = new Date()) => (type === 'annual' ? String(d.getFullYear()) : type === 'quarterly' ? d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
export const keyLabel = (type, key) => (type === 'annual' ? 'سنة ' + key : type === 'quarterly' ? 'الربع ' + key.slice(-1) + ' / ' + key.slice(0, 4) : MONTHS[+key.slice(5) - 1] + ' ' + key.slice(0, 4));
export const pct = (t) => (Number(t.target_value) > 0 ? Math.max(0, Math.min(100, Math.round((Number(t.actual_value) || 0) / Number(t.target_value) * 100))) : null);
export const ratingOf = (p) => (p >= 90 ? 'ممتاز' : p >= 75 ? 'جيد جداً' : p >= 60 ? 'جيد' : p >= 50 ? 'مقبول' : 'ضعيف');

export const listTargets = async (employeeId, year) => (await rpc('ariba_targets_list', { p_employee_id: String(employeeId), p_year: String(year) })).targets || [];
export const saveTarget = (t) => rpc('ariba_target_save', { p_target: t });
export const deleteTarget = (id) => rpc('ariba_target_delete', { p_id: id });
export const getEval = (employeeId, type, key) => rpc('ariba_eval_get', { p_employee_id: String(employeeId), p_type: type, p_key: key });
export const saveEval = (employeeId, type, key, items, comments, submit) => rpc('ariba_eval_save', { p_employee_id: String(employeeId), p_type: type, p_key: key, p_items: items, p_comments: comments || '', p_submit: !!submit });
export const approveEval = (id) => rpc('ariba_eval_approve', { p_evaluation_id: id });
export const listEvals = async (status) => (await rpc('ariba_eval_list', { p_status: status || null })).evaluations || [];
export const myGoals = () => rpc('ariba_my_goals');
