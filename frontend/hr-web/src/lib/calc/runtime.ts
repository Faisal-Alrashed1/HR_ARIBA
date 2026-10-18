/* eslint-disable */
// @ts-nocheck
// Copied verbatim from ARIBA_HR_React/src/engines/runtime.js (their engines' shared state). Do not edit by hand.
// حالة التشغيل التي تعتمد عليها المعادلات (تُحدَّث من مخزن React). المعادلات نفسها دوال نقية تقرأ منها فقط.
export const rt = {
  country: 'SA',                 // 'SA' | 'EG'
  egRules: null,                 // تعديلات المستخدم على قواعد مصر
  leaveCarry: { enabled: true, days: 10 },
  leaveAccrual: 'calendar',
  insRules: null,                // إعدادات التأمينات المخزنة (insuranceRules)
  holidays: [],                  // الإجازات الرسمية [{date,days,recurring}]
  leaves: [],                    // طلبات الإجازة
  adjustments: [],               // leave_balance_adjustments
  employees: [],
  schedule: null,                // جدول الدوام الرسمي/رمضان (lib/schedule.js)
};
export function setRuntime(patch) { Object.assign(rt, patch); clearLeaveCache(); }
let cache = new Map();
export function clearLeaveCache() { cache = new Map(); }
export function perfGet(key, fn) { if (cache.has(key)) return cache.get(key); const v = fn(); cache.set(key, v); return v; }
