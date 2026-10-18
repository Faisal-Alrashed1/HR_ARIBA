import { rpc } from './api.js';
export const payrollDraft = (y, m) => rpc('ariba_payroll_draft_get', { p_year: y, p_month: m });
export const payrollStatus = (y, m) => rpc('ariba_payroll_status_get', { p_year: y, p_month: m });
export const payrollSync = (y, m, approved, approvedAt, rows) => rpc('ariba_sync_payroll', { p_year: y, p_month: m, p_approved: !!approved, p_approved_at: approvedAt || null, p_rows: rows || [] });
export const payrollPrepare = (y, m, note) => rpc('ariba_payroll_prepare', { p_year: y, p_month: m, p_note: note || '' });
export const payrollReopen = (y, m, reason) => rpc('ariba_payroll_reopen', { p_year: y, p_month: m, p_reason: reason });
export const payrollArchive = (y, m) => rpc('ariba_payroll_archive', y ? { p_year: y, p_month: m } : {});
