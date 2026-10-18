/* eslint-disable */
// @ts-nocheck
// leaveAnnual from ARIBA_HR_React/src/engines/leave.js (annual days of the contract; Egypt by age and service), verbatim.
import * as C from './country';
export function leaveAnnual(e) { if (C.isEG()) return C.annualDays(e, new Date()); return Math.max(0, Number(e.leaveDaysContract || e.ldc || 21) || 21); }
