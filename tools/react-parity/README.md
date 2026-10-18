# react-parity

Their React formulas (copied read-only into `reference/`) against ours — the site's `frontend/hr-web/src/lib/calc/*`
(TypeScript, transpiled on the fly) and the backend services (`ours.py`, real backend code) — on the same seeded cases.

```
npm test          # summary; exit code 1 while any formula differs
npm run report    # + results/report.json and results/REPORT.md
node --import ./freeze.mjs run.mjs --only=payx,leave   # some suites only (TZ=Asia/Riyadh)
```

- No `npm install`: TypeScript comes from `frontend/hr-web/node_modules`, Python from `backend/.venv`.
- The clock is frozen (`PARITY_NOW`, default `2026-10-18T10:00:00`) because both systems read "today".
- `reference/` is a verbatim copy of `ARIBA_HR_React/src/engines/*`, `lib/{schedule,tafqeet,goals,util}.js`, the pure helpers of
  `lib/finance.js`, `lib/employees.js` (salaryPreview), `lib/data.js` (normalizeEmployee) and the pure functions of
  `pages/finance/*` (each file names the lines it was cut from). Do not edit it; the HR department sends no more updates.
- Every compared field is tied to its row in `docs/port-context/مقارنة_المعادلات.xlsx` (`comparison_rows.json`). Before the
  port the run reproduced the file's differences (`results/BASELINE_2026-10-18.md`); since task 3 every tested row must show
  none — the exit code is 1 while any case or row still differs.
- Suites: `payx` (A..AW), `rows` (payroll rows layer), `eos`, `settle`, `rates`, `figures`, `leave_{calendar,monthly,workdays}`,
  `attendance` (+ schedule/Ramadan), `tafqeet`, `alerts`, and the formulas only they had (`salcalc`, `tax`, `assets`,
  `yearreport`, `wps`, `goals`, `egypt`, `inscalc`, `prov`) — counted as missing until our module exists.
