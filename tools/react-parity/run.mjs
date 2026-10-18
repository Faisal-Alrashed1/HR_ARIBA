// react-parity: their React formulas (reference/) vs ours (site TS + backend Python) on the same seeded cases.
//   npm test            → prints the summary, exit 1 when any formula differs
//   npm run report      → also writes results/report.json and results/REPORT.md
// Decisions 1/2 of docs/PORT_PLAN.md apply: rows 113/142 are compared to their app screen, row 66 is not a formula here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildOurs } from './lib/ours-ts.mjs';
import * as PR from './suites/payroll.mjs';
import * as EO from './suites/eos.mjs';
import * as IN from './suites/insurance.mjs';
import * as LV from './suites/leave.mjs';
import * as MI from './suites/misc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const write = process.argv.includes('--write');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (id) => !only.length || only.some((o) => id.startsWith(o));
const ours = buildOurs();
const results = [];
const t0 = Date.now();

// ---- phase 1: cases for the Python side
const py = {};
const rateCases = want('rates') ? IN.ratesPrepare(py) : null;
const figCases = want('figures') ? IN.figuresPrepare(py) : null;
const leaveData = want('leave') ? LV.leaveData() : null;
if (leaveData) LV.leavePrepare(py, leaveData);
const alertEmps = want('alerts') ? MI.alertsPrepare(py) : null;

let pyOut = {};
if (Object.keys(py).length) {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'rp-')), inF = path.join(tmp, 'in.json'), outF = path.join(tmp, 'out.json');
  fs.writeFileSync(inF, JSON.stringify(py));
  const exe = path.resolve(here, '../../backend/.venv/bin/python');
  const p = spawnSync(exe, ['-I', path.join(here, 'ours.py'), inF, outF], { encoding: 'utf8', env: { ...process.env, ENV: 'development', DATABASE_URL: 'postgresql:///unused?host=/tmp' } });
  if (p.status !== 0) { console.error(p.stderr || p.stdout); process.exit(2); }
  pyOut = JSON.parse(fs.readFileSync(outF, 'utf8'));
}

// ---- phase 2: run and compare
if (want('payx')) results.push(PR.payx(ours));
if (want('rows')) results.push(PR.rows(ours));
if (want('eos')) results.push(EO.eosPage(ours));
if (want('settle')) results.push(EO.settlement(ours));
if (rateCases) results.push(IN.rates(rateCases, pyOut.rates));
if (figCases) results.push(IN.figures(figCases, pyOut.figures));
if (leaveData) for (const m of ['calendar', 'monthly', 'workdays']) results.push(LV.leave(leaveData, pyOut.leave[0], m));
if (want('attendance')) results.push(MI.attendance(ours));
if (want('tafqeet')) results.push(MI.tafqeet(ours));
if (alertEmps) results.push(MI.alerts(alertEmps, pyOut.alerts));
if (want('new')) results.push(...MI.theirsOnly(ours));

// ---- the verdict per comparison-file row
const rowsMeta = JSON.parse(fs.readFileSync(path.join(here, 'comparison_rows.json'), 'utf8'));
const tested = {};
results.forEach((t) => {
  Object.entries(t.rowCases).forEach(([r, n]) => { (tested[r] = tested[r] || { cases: 0, diffs: 0, suites: new Set() }).cases += n; tested[r].suites.add(t.id); });
  Object.entries(t.rowDiffs).forEach(([r, n]) => { tested[r].diffs += n; });
});
// Rows where the run and the file legitimately disagree, with the reason (checked by hand).
const EXPLAIN = {
  34: 'خطأ عندنا كشفته الأداة: /salary/basis يرسل insSystem كما هو (new/old) وصفحة المسيّر تقارنه بـ "matching"، فالمطابق يظهر «لا يطابق». يُصلَح في المهمة 3.',
  36: 'نفس المصدر للسعودية؛ الفرق لمصر فقط (يُغطّى في مجموعة egypt).',
  81: 'في المخالصة لا تساوي المدة 5 سنوات بالضبط (اليوم الأخير يُحسب، fd ≥ 1)، فالفرق بين < و ≤ نظري. يُعدَّل الشرط ليطابقهم.',
};
const EXPECT_DIFF = new Set(['شبه مطابق', 'غير مطابق', 'عندهم فقط', 'عندنا فقط']);
const verdict = Object.entries(tested).sort((a, b) => +a[0] - +b[0]).map(([r, v]) => {
  const m = rowsMeta[r] || {}, expected = EXPECT_DIFF.has(m.status), found = v.diffs > 0;
  return { row: +r, area: m.area, formula: m.formula, status: m.status, cases: v.cases, diffs: v.diffs, found, agrees: expected === found, note: EXPLAIN[r] || '', suites: [...v.suites] };
});

// ---- output
const total = results.reduce((s, t) => s + t.cases, 0), diff = results.reduce((s, t) => s + t.diffCases, 0), unexpl = results.reduce((s, t) => s + t.unexplained, 0);
console.log(`react-parity — ${results.length} suites, ${total.toLocaleString('en-US')} cases, ${diff.toLocaleString('en-US')} with differences, ${unexpl} unexplained (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
results.forEach((t) => {
  const top = Object.entries(t.causes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`${t.diffCases ? '✗' : '✓'} ${t.id.padEnd(14)} ${String(t.cases).padStart(6)} cases  ${String(t.diffCases).padStart(6)} diff  ${top}`);
  t.notes.forEach((n) => console.log('    ' + n));
});
const disagree = verdict.filter((v) => !v.agrees);
console.log(`rows tested: ${verdict.length} · agree with the comparison file: ${verdict.length - disagree.length} · disagree: ${disagree.length}`);
disagree.forEach((v) => console.log(`   row ${v.row} (${v.status}) ${v.formula}: ${v.found ? `${v.diffs} diff found` : 'no diff found'} [${v.suites.join(',')}]${v.note ? ' — ' + v.note : ''}`));

if (write) {
  const dir = path.join(here, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = { now: globalThis.__parityToday(), at: new Date(Date.now()).toISOString() };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ stamp, total, diff, unexplained: unexpl, suites: results.map((t) => t.toJSON()), verdict }, null, 1));
  const md = [`# react-parity — النتيجة`, '', `اليوم المثبّت: ${stamp.now} · ${results.length} مجموعة · ${total.toLocaleString('en-US')} حالة · ${diff.toLocaleString('en-US')} فيها فرق · غير مفسَّر: ${unexpl}`, '',
    '| المجموعة | الحالات | فيها فرق | الأسباب |', '|---|---|---|---|',
    ...results.map((t) => `| ${t.title} | ${t.cases.toLocaleString('en-US')} | ${t.diffCases.toLocaleString('en-US')} | ${Object.entries(t.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join('، ') || '—'} |`),
    '', '## الصفوف المفحوصة مقابل ملف المقارنة', '', '| الصف | المعادلة | حالته في الملف | حالات | فيها فرق | يوافق الملف |', '|---|---|---|---|---|---|',
    ...verdict.map((v) => `| ${v.row} | ${v.formula} | ${v.status} | ${v.cases} | ${v.diffs} | ${v.agrees ? '✅' : '❌ ' + v.note} |`), ''];
  results.forEach((t) => t.notes.forEach((n) => md.push(`- ${t.id}: ${n}`)));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), md.join('\n'));
  console.log('wrote results/report.json and results/REPORT.md');
}
process.exitCode = diff ? 1 : 0;
