import { getSetting, setSetting } from '../../lib/api.js';
// خطاب تعريف راتب (V117): على نموذج الشركة — تاريخ هجري/ميلادي + رقم صادر + جدول البيانات + توقيع وختم
import { esc } from '../../lib/print.js';
import { wrap } from './docs.js';
import { sigHtml, todayInfo } from '../../lib/hrSig.js';

const X = esc;
export const num = (v) => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
export const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: Math.round(n * 100) % 100 ? 2 : 0, maximumFractionDigits: 2 });
export function salaryOf(e) {
  let b = num(e.salary); const h = num(e.housingAllowance), t = num(e.transportAllowance), o = num(e.otherAllowance);
  if (!b && !h && !t && !o && num(e.salaryTotal)) b = num(e.salaryTotal);
  return { basic: b, housing: h, transport: t, other: o };
}
export const acctFromIban = (iban) => { const s = String(iban || '').replace(/\s+/g, ''); return /^SA\d{22}$/i.test(s) ? s.slice(6) : ''; };
const dmy = (iso) => { const s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 && s[0] ? s[2] + '/' + s[1] + '/' + s[0] : ''; };
// ADAPTED (decision 3): the issue place per employee and the daily reference counter live on the server
// (ariba_app_settings 'id_issue_place' / 'salary_cert_seq'), loaded once and saved on change — not in localStorage.
const srv = { place: {}, seq: {} };
getSetting('id_issue_place').then((v) => { if (v && typeof v === 'object') srv.place = v; }).catch(() => {});
getSetting('salary_cert_seq').then((v) => { if (v && typeof v === 'object') srv.seq = v; }).catch(() => {});
export const placeOf = (e) => e.idIssuePlace || e.iqamaPlace || e.issuePlace || srv.place[e.id] || '';
export const savePlace = (e, v) => { srv.place = { ...srv.place, [e.id]: String(v || '').trim() }; setSetting('id_issue_place', srv.place).catch(() => {}); };
const seqKey = () => todayInfo().ymd;
export const nextRef = (offset = 0) => 'AR-' + todayInfo().ymd + '-' + ((parseInt(srv.seq[seqKey()], 10) || 0) + 1 + offset);
export const consumeRef = () => { const k = seqKey(); srv.seq = { [k]: (parseInt(srv.seq[k], 10) || 0) + 1 }; setSetting('salary_cert_seq', srv.seq).catch(() => {}); };

/** بيانات الخطاب من ملف الموظف (للإرسال الجماعي) — الكارت بيعمل نفس الشكل من الحقول */
export function dataFromEmp(e, tr, { to = '', toEn = '', bankOn = false, seal = true, offset = 0 } = {}) {
  const s = salaryOf(e), tEn = (x) => { if (!x) return ''; const r = tr ? tr(x) : x; return /[؀-ۿ]/.test(r) ? '' : r; };
  const d = { e, nameAr: e.nameAr || '', nameEn: e.nameEn || tEn(e.nameAr), empNo: String(e.empNo || ''), join: e.contractJoin || e.join || e.joinDate || '', natAr: e.nationality || e.nat || '', jobAr: e.jobTitle || e.job || '', id: String(e.iqamaNo || e.iqama || ''), placeAr: placeOf(e), basic: s.basic, housing: s.housing, transport: s.transport, other: s.other, iban: e.iban || '', bank: e.bank || '', acct: acctFromIban(e.iban), ref: nextRef(offset), bankOn, toAr: to, toEn: toEn || to, seal };
  d.natEn = tEn(d.natAr); d.jobEn = tEn(d.jobAr); d.placeEn = tEn(d.placeAr); d.total = d.basic + d.housing + d.transport + d.other;
  return d;
}
export function missing(lang, d) {
  const en = lang === 'en', m = []; const chk = (ok, ar, eng, id) => { if (!ok) m.push({ id, label: en ? eng : ar }); };
  chk(d.toAr, 'الجهة الموجه إليها الخطاب', 'Addressed to', 'SC_TO');
  chk(en ? d.nameEn : d.nameAr, en ? 'اسم الموظف بالإنجليزي' : 'اسم الموظف', 'Employee name (English)', 'SC_' + (en ? 'NAME_EN' : 'NAME'));
  chk(d.empNo, 'الرقم الوظيفي', 'Employee no.', 'SC_EMPNO'); chk(d.join, 'تاريخ التعيين', 'Hire date', 'SC_JOIN');
  chk(en ? d.natEn : d.natAr, 'الجنسية', 'Nationality', 'SC_' + (en ? 'NAT_EN' : 'NAT')); chk(en ? d.jobEn : d.jobAr, 'المسمى الوظيفي', 'Job title', 'SC_' + (en ? 'JOB_EN' : 'JOB'));
  chk(d.id, 'رقم الهوية / الإقامة', 'ID / Iqama no.', 'SC_ID'); chk(en ? d.placeEn : d.placeAr, 'مكان الإصدار', 'Place of issue', 'SC_' + (en ? 'PLACE_EN' : 'PLACE'));
  chk(d.total > 0, 'الراتب (الأساسي على الأقل)', 'Salary (basic at least)', 'SC_BASIC');
  if (d.bankOn) chk(d.iban, 'IBAN', 'IBAN', 'SC_IBAN');
  return m;
}
const SC_CSS = '<style>.sc-ref{font-size:12.5px;line-height:1.9;margin:0 0 4mm}.sc-t{width:100%;border-collapse:collapse;border:2px solid #111;margin:3.5mm 0;table-layout:fixed}.sc-t td{border:1px solid #222;padding:5px 6px;font-size:12px;text-align:center;vertical-align:middle;height:9mm;word-break:break-word}.sc-l{background:#014D3D;color:#fff;font-weight:800}.sc-s{background:#29B35E;color:#fff;font-weight:800}.sc-v{font-weight:700;color:#111}</style>';
export function scHtml(lang, d, { settings, employees, tr }) {
  const en = lang === 'en', dir = en ? 'ltr' : 'rtl', al = en ? 'left' : 'right', t = todayInfo(), cur = en ? 'SAR' : 'ر.س';
  const X1 = (s) => X(s == null || s === '' ? '—' : s);
  const P = (h, ex) => '<p class="tf-p" dir="' + dir + '" style="text-align:' + (ex || 'justify') + ';margin:0 0 3mm">' + h + '</p>';
  const nm = en ? d.nameEn : d.nameAr, nat = en ? d.natEn : d.natAr, job = en ? d.jobEn : d.jobAr, place = en ? d.placeEn : d.placeAr, to = en ? d.toEn : d.toAr;
  const amt = (n) => money(n) + ' ' + cur;
  const L = en ? { name: 'Name', no: 'Employee No.', hire: 'Hire date', job: 'Job title', nat: 'Nationality', id: 'ID / Iqama No.', place: 'Place of issue', sal: 'Salary', basic: 'Basic', hous: 'Housing', tran: 'Transport', oth: 'Other allowances', tot: 'Total' }
    : { name: 'الاســـــم', no: 'الرقم الوظيفــي', hire: 'تاريخ التعييـــن', job: 'المسمى الوظيفي', nat: 'الجنسيــــــة', id: 'الهويـــــــــة', place: 'مكـــان الإصـــدار', sal: 'الراتب', basic: 'الأساسي', hous: 'السكن', tran: 'المواصلات', oth: 'بدلات أخرى', tot: 'الإجمالي' };
  const cg = '<colgroup><col style="width:19.1%"><col style="width:25%"><col style="width:22.1%"><col style="width:15%"><col style="width:18.8%"></colgroup>';
  const lab = (x, cls, extra) => '<td class="' + (cls || 'sc-l') + '"' + (extra || '') + '>' + x + '</td>';
  const vv = (x, extra) => '<td class="sc-v"' + (extra || '') + '>' + X1(x) + '</td>';
  const table = '<table class="sc-t" dir="' + dir + '">' + cg
    + '<tr>' + lab(L.name) + vv(nm, ' colspan="4"') + '</tr>'
    + '<tr>' + lab(L.no) + vv(d.empNo) + lab(L.hire) + vv(dmy(d.join), ' colspan="2"') + '</tr>'
    + '<tr>' + lab(L.nat) + vv(nat) + lab(L.job) + vv(job, ' colspan="2"') + '</tr>'
    + '<tr>' + lab(L.id, 'sc-l', ' rowspan="2"') + vv(d.id, ' rowspan="2"') + lab(L.sal, 'sc-l', ' rowspan="5"') + lab(L.basic, 'sc-s') + vv(amt(d.basic)) + '</tr>'
    + '<tr>' + lab(L.hous, 'sc-s') + vv(amt(d.housing)) + '</tr>'
    + '<tr>' + lab(L.place, 'sc-l', ' rowspan="3"') + vv(place, ' rowspan="3"') + lab(L.tran, 'sc-s') + vv(amt(d.transport)) + '</tr>'
    + '<tr>' + lab(L.oth, 'sc-s') + vv(amt(d.other)) + '</tr>'
    + '<tr>' + lab(L.tot, 'sc-s') + '<td class="sc-v" style="font-weight:900">' + X(amt(d.total)) + '</td></tr></table>';
  let bank = '';
  const trEn = (x) => (tr ? tr(x) : x);
  if (d.bankOn && (d.iban || d.bank || d.acct)) bank = '<div class="tf-box" dir="' + dir + '" style="text-align:' + al + '">' + (d.bank ? '<div><b>' + (en ? 'Bank name' : 'اسم البنك') + ':</b> ' + X(en ? (trEn(d.bank) || d.bank) : d.bank) + '</div>' : '') + (d.acct ? '<div><b>' + (en ? 'Account number' : 'رقم الحساب') + ':</b> <span dir="ltr">' + X(d.acct) + '</span></div>' : '') + (d.iban ? '<div><b>IBAN:</b> <span dir="ltr">' + X(d.iban) + '</span></div>' : '') + '</div>';
  const ref = en
    ? '<div class="sc-ref" dir="ltr" style="text-align:left"><div><b>Date:</b> ' + t.hd + ' / ' + t.hm + ' / ' + t.hy + ' AH &nbsp;&nbsp; <b>Corresponding to:</b> ' + t.gd + ' / ' + t.gm + ' / ' + t.gy + '</div><div><b>Ref:</b> ' + X(d.ref) + '</div></div>'
    : '<div class="sc-ref" dir="rtl" style="text-align:right"><div><b>التاريــخ :</b> ' + t.hd + ' / ' + t.hm + ' / ' + t.hy + 'هـ</div><div><b>الموافق:</b> ' + t.gd + ' / ' + t.gm + ' / ' + t.gy + 'م</div><div><b>الصـــادر:</b> <span dir="ltr">' + X(d.ref) + '</span></div></div>';
  const sig = sigHtml(settings, employees, lang, { mt: 3, h: 36, noImg: !d.seal }, tr);
  const body = SC_CSS + ref
    + P('<b>' + (en ? 'Messrs. ' : 'السادة/ ') + X(to) + (en ? '' : ' &nbsp;المحترمين') + '</b>', 'start')
    + P(en ? 'Greetings and peace be upon you...' : 'السلام عليكم ورحمة الله وبركاته...', 'start')
    + P(en ? 'We, Ariba Business Solutions Company, hereby confirm that the employee whose details are below is employed with us up to the date of this letter:' : 'نفيدكم نحن شركة حلول أريبا لخدمات الأعمال بأن الموظف الآتي بياناته يعمل لدينا حتى تاريخه:')
    + table + bank
    + P(en ? 'This certificate was issued at his/her request without any liability on the Company.' : 'وقد أعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.')
    + P(en ? 'With our best regards...' : 'وتفضلوا بقبول فائق الشكر والتقدير...', 'center') + sig;
  const html = wrap('', '', body).replace('<div class="doc-title"></div>', '');
  return { e: d.e, type: 'salary_cert', title: en ? 'Salary Certificate' : 'تعريف بالراتب', html, ref: d.ref };
}
