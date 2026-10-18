// قراءة ملفات Excel (xlsx) / CSV بدون أي مكتبة خارجية + مطابقة الأعمدة + تحويل القيم (استيراد الموظفين V139)
const inflateRaw = async (u8) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
function unzip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; } }
  if (e < 0) throw new Error('not a zip');
  const cnt = dv.getUint16(e + 10, true); let off = dv.getUint32(e + 16, true); const files = {};
  for (let k = 0; k < cnt; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csz = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
    const name = new TextDecoder('utf-8').decode(u8.subarray(off + 46, off + 46 + nl)), lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), st = lo + 30 + lnl + lxl;
    files[name] = { method, data: u8.subarray(st, st + csz) }; off += 46 + nl + xl + cl;
  }
  return files;
}
const ztext = async (files, name) => { const f = files[name]; if (!f) return ''; const d = f.method === 0 ? f.data : await inflateRaw(f.data); return new TextDecoder('utf-8').decode(d); };
const colIdx = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); let n = 0; if (!m) return 0; for (let i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; };
export async function readXlsx(buf) {
  const files = unzip(new Uint8Array(buf)), NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', P = (x) => new DOMParser().parseFromString(x, 'application/xml');
  const ss = [], sx = await ztext(files, 'xl/sharedStrings.xml');
  if (sx) { const sd = P(sx).getElementsByTagNameNS(NS, 'si'); for (let i = 0; i < sd.length; i++) { const ts = sd[i].getElementsByTagNameNS(NS, 't'); let s = ''; for (let j = 0; j < ts.length; j++) s += ts[j].textContent; ss.push(s); } }
  const styles = P((await ztext(files, 'xl/styles.xml')) || '<x/>'), dateXf = {}, fmts = {};
  [].slice.call(styles.getElementsByTagNameNS(NS, 'numFmt')).forEach((n) => { fmts[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
  const cx = styles.getElementsByTagNameNS(NS, 'cellXfs')[0];
  if (cx) [].slice.call(cx.getElementsByTagNameNS(NS, 'xf')).forEach((x, i) => { const id = x.getAttribute('numFmtId'), code = fmts[id] || ''; if ((+id >= 14 && +id <= 22) || (+id >= 45 && +id <= 47) || (code && !/^General$/i.test(code) && /[dmyh]/i.test(code.replace(/\[[^\]]*\]|"[^"]*"/g, '')))) dateXf[i] = true; });
  const wb = P(await ztext(files, 'xl/workbook.xml')), sheets = wb.getElementsByTagNameNS(NS, 'sheet'), rels = {}, rx = await ztext(files, 'xl/_rels/workbook.xml.rels');
  if (rx) [].slice.call(P(rx).getElementsByTagName('Relationship')).forEach((r) => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
  const out = [];
  for (let si = 0; si < sheets.length; si++) {
    const sh = sheets[si], rid = sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sh.getAttribute('r:id'), tgt = (rels[rid] || ('worksheets/sheet' + (si + 1) + '.xml')).replace(/^\//, '').replace(/^xl\//, '');
    const sxml = await ztext(files, 'xl/' + tgt); if (!sxml) continue; const rows = P(sxml).getElementsByTagNameNS(NS, 'row'), grid = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const cells = rows[ri].getElementsByTagNameNS(NS, 'c'), line = []; let any = false;
      for (let ci = 0; ci < cells.length; ci++) {
        const c = cells[ci], t = c.getAttribute('t'), v = c.getElementsByTagNameNS(NS, 'v')[0]; let val = '';
        if (t === 's' && v) val = ss[parseInt(v.textContent, 10)] || '';
        else if (t === 'inlineStr') { const it = c.getElementsByTagNameNS(NS, 't'); for (let q = 0; q < it.length; q++) val += it[q].textContent; }
        else if (t === 'b' && v) val = v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (v) { val = v.textContent; const sIdx = +c.getAttribute('s'); if (dateXf[sIdx] && Number.isFinite(+val)) val = '\u0001' + val; }
        if (String(val).trim() !== '') any = true; line[colIdx(c.getAttribute('r'))] = val;
      }
      if (any) grid.push(line);
    }
    out.push({ name: sh.getAttribute('name') || ('Sheet' + (si + 1)), rows: grid });
  }
  return out;
}
export function readCsv(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.split('\t').length > first.split(';').length && first.split('\t').length > first.split(',').length) ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = []; let row = [], cur = '', q = false; const flush = () => { row.push(cur); cur = ''; if (row.some((x) => String(x).trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; flush(); } else cur += ch; }
  flush(); return [{ name: 'CSV', rows }];
}
export async function readFile(file) {
  const buf = await file.arrayBuffer(); const u = new Uint8Array(buf);
  if (u[0] === 0x50 && u[1] === 0x4b) return readXlsx(buf);
  return readCsv(new TextDecoder('utf-8').decode(buf));
}
const AD = '٠١٢٣٤٥٦٧٨٩';
export const digits = (v) => String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => AD.indexOf(d));
export const nn = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '');
const num = (v) => { const n = parseFloat(digits(String(v == null ? '' : v)).replace(/[,\s٬]/g, '')); return Number.isFinite(n) ? n : 0; };
const p2 = (n) => (n < 10 ? '0' : '') + n;
export const FIELDS = [
  { k: 'nameAr', ar: 'الاسم بالعربي', h: ['الاسم', 'الاسم بالعربي', 'اسم الموظف', 'الاسم عربي', 'اسم', 'name', 'name ar', 'arabic name', 'employee name', 'full name'] },
  { k: 'nameEn', ar: 'الاسم بالإنجليزي', h: ['الاسم بالانجليزي', 'الاسم انجليزي', 'الاسم بالإنجليزي', 'name en', 'english name', 'name english'] },
  { k: 'empNo', ar: 'الرقم الوظيفي', h: ['الرقم الوظيفي', 'رقم الموظف', 'رقم وظيفي', 'كود الموظف', 'الكود', 'emp no', 'employee no', 'employee number', 'employee id', 'emp id', 'id no'] },
  { k: 'iqamaNo', ar: 'رقم الهوية / الإقامة', h: ['رقم الهويه', 'رقم الهوية', 'رقم الاقامه', 'رقم الإقامة', 'رقم الهوية/الاقامة', 'رقم الهويه/الاقامه', 'الهويه', 'الهوية', 'الاقامه', 'الإقامة', 'iqama', 'iqama no', 'iqama number', 'id number', 'national id', 'residence no'] },
  { k: 'iqamaExpiry', ar: 'انتهاء الهوية / الإقامة', h: ['انتهاء الاقامه', 'انتهاء الإقامة', 'تاريخ انتهاء الاقامه', 'تاريخ انتهاء الهويه', 'انتهاء الهويه', 'iqama expiry', 'id expiry'] },
  { k: 'nationality', ar: 'الجنسية', h: ['الجنسيه', 'الجنسية', 'nationality'] },
  { k: 'dob', ar: 'تاريخ الميلاد', h: ['تاريخ الميلاد', 'الميلاد', 'date of birth', 'dob', 'birth date'] },
  { k: 'employer', ar: 'جهة العمل', h: ['جهه العمل', 'جهة العمل', 'الشركه', 'الشركة', 'المنشاه', 'المنشأة', 'employer', 'company'] },
  { k: 'dept', ar: 'القسم', h: ['القسم', 'الاداره', 'الإدارة', 'department', 'dept'] },
  { k: 'jobTitle', ar: 'المسمى الوظيفي', h: ['المسمى الوظيفي', 'الوظيفه', 'الوظيفة', 'المسمى', 'job title', 'position', 'title', 'job'] },
  { k: 'mobile', ar: 'الجوال', h: ['الجوال', 'رقم الجوال', 'الهاتف', 'موبايل', 'mobile', 'phone', 'tel'] },
  { k: 'email', ar: 'البريد الإلكتروني', h: ['البريد', 'البريد الالكتروني', 'الايميل', 'الإيميل', 'email', 'e-mail', 'mail'] },
  { k: 'contractJoin', ar: 'تاريخ المباشرة', h: ['تاريخ المباشره', 'تاريخ المباشرة', 'تاريخ التعيين', 'تاريخ الالتحاق', 'بداية العقد', 'تاريخ بدايه العقد', 'join date', 'joining date', 'start date', 'hire date'] },
  { k: 'contractDuration', ar: 'مدة العقد (شهر)', h: ['مده العقد', 'مدة العقد', 'مدة العقد بالشهور', 'مدة العقد (شهر)', 'contract duration', 'duration'] },
  { k: 'contractNature', ar: 'طبيعة العقد (محدد/غير محدد)', h: ['طبيعه العقد', 'طبيعة العقد', 'نوع العقد', 'contract nature', 'contract type'] },
  { k: 'salary', ar: 'الراتب الأساسي', h: ['الراتب الاساسي', 'الراتب الأساسي', 'الاساسي', 'الأساسي', 'اساسي', 'basic', 'basic salary', 'salary'] },
  { k: 'housingAllowance', ar: 'بدل السكن', h: ['بدل السكن', 'السكن', 'housing', 'housing allowance'] },
  { k: 'transportAllowance', ar: 'بدل النقل', h: ['بدل النقل', 'بدل المواصلات', 'النقل', 'المواصلات', 'transport', 'transportation', 'transport allowance'] },
  { k: 'projectAllowance', ar: 'بدل المشروع', h: ['بدل المشروع', 'بدل مشروع', 'المشروع', 'project allowance', 'project'] },
  { k: 'otherAllowance', ar: 'بدلات أخرى', h: ['بدلات اخرى', 'بدلات أخرى', 'بدل اخر', 'بدل آخر', 'اخرى', 'أخرى', 'other allowance', 'other allowances', 'other'] },
  { k: 'extraAllowance', ar: 'الإضافي', h: ['الاضافي', 'الإضافي', 'اضافي', 'overtime', 'extra'] },
  { k: 'otherDeductions', ar: 'استقطاعات', h: ['استقطاعات', 'خصومات', 'الاستقطاعات', 'deductions', 'deduction'] },
  { k: 'insSystem', ar: 'نظام التأمينات', h: ['نظام التامينات', 'نظام التأمينات', 'التامينات', 'التأمينات', 'insurance system', 'gosi system'] },
  { k: 'wpsType', ar: 'نوع الموظف', h: ['نوع الموظف', 'تصنيف الموظف', 'فئه الموظف', 'فئة الموظف', 'employee type', 'category', 'wps type'] },
  { k: 'iban', ar: 'الآيبان', h: ['الايبان', 'الآيبان', 'رقم الايبان', 'رقم الآيبان', 'iban', 'iban no'] },
  { k: 'bank', ar: 'البنك', h: ['البنك', 'اسم البنك', 'bank', 'bank name'] },
  { k: 'payMethod', ar: 'طريقة الدفع', h: ['طريقه الدفع', 'طريقة الدفع', 'payment method', 'pay method'] },
  { k: 'currency', ar: 'العملة', h: ['العمله', 'العملة', 'currency'] },
  { k: 'exchRate', ar: 'سعر الصرف', h: ['سعر الصرف', 'معدل الصرف', 'exchange rate', 'fx'] },
  { k: 'leaveDaysContract', ar: 'الإجازة السنوية (يوم)', h: ['الاجازه السنويه', 'الإجازة السنوية', 'ايام الاجازه', 'أيام الإجازة', 'annual leave', 'leave days'] },
  { k: 'passportNo', ar: 'رقم الجواز', h: ['رقم الجواز', 'الجواز', 'passport', 'passport no'] },
  { k: 'passportExpiry', ar: 'انتهاء الجواز', h: ['انتهاء الجواز', 'تاريخ انتهاء الجواز', 'passport expiry'] },
  { k: 'religion', ar: 'الديانة', h: ['الديانه', 'الديانة', 'religion'] },
  { k: 'sponsor', ar: 'الكفيل', h: ['الكفيل', 'sponsor'] },
  { k: 'manager', ar: 'المدير المباشر', h: ['المدير المباشر', 'المدير', 'direct manager', 'manager'] },
];
const HMAP = {}; FIELDS.forEach((f) => f.h.concat([f.ar, f.k]).forEach((h) => { HMAP[nn(h)] = f.k; }));
export const autoMap = (header) => header.map((h) => { const k = nn(h); if (!k) return ''; if (HMAP[k]) return HMAP[k]; let best = '', bl = 0; Object.keys(HMAP).forEach((x) => { if (x.length >= 4 && (k.includes(x) || x.includes(k)) && x.length > bl) { best = HMAP[x]; bl = x.length; } }); return best; });
const valid = (y, m, d) => { if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return ''; const dt = new Date(y, m - 1, d); if (dt.getMonth() !== m - 1) return ''; return y + '-' + p2(m) + '-' + p2(d); };
const serial = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
export function toISO(raw) {
  let v = String(raw == null ? '' : raw).trim(); if (!v) return '';
  if (v.charAt(0) === '\u0001') return serial(parseFloat(v.slice(1)));
  v = digits(v); let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v); if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(v); if (m) return valid(+m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(v) && +v > 20000 && +v < 80000) return serial(+v); return '';
}
export const isSaudiNat = (v) => /^(سعودي|سعوديه|saudi|ksa|sa|saudi arabia|saudi arabian)$/.test(nn(v));
export function conv(k, raw) {
  const v = String(raw == null ? '' : raw).trim();
  switch (k) {
    case 'dob': case 'iqamaExpiry': case 'passportExpiry': case 'contractJoin': return toISO(raw);
    case 'salary': case 'housingAllowance': case 'transportAllowance': case 'projectAllowance': case 'otherAllowance': case 'extraAllowance': case 'otherDeductions': case 'exchRate': case 'contractDuration': case 'leaveDaysContract': return v === '' ? '' : num(v);
    case 'iqamaNo': case 'mobile': return digits(v).replace(/[^\d+]/g, '');
    case 'iban': return digits(v).replace(/\s+/g, '').toUpperCase();
    case 'insSystem': { const n = nn(v); if (!n) return ''; if (/غير خاضع|اعفاء|exempt/.test(n)) return 'exempt'; if (/غير سعودي|expat|non/.test(n)) return 'expat'; if (/جديد|new|^يطابق/.test(n)) return 'new'; if (/قديم|old|لا يطابق/.test(n)) return 'old'; return ''; }
    case 'wpsType': { const w = nn(v); if (!w) return ''; if (/تمهير|tamheer/.test(w)) return 'tamheer'; if (/متدرب|تدريب|trainee/.test(w)) return 'trainee'; if (/استشار|consult/.test(w)) return 'consultant'; if (/مدد|wps|عادي|موظف|regular/.test(w)) return 'wps'; return ''; }
    case 'contractNature': { const c = nn(v); if (!c) return ''; if (/غير محدد|مفتوح|indefinite|open|unlimited|permanent|دائم/.test(c)) return 'indefinite'; if (/محدد|fixed|limited/.test(c)) return 'fixed'; return ''; }
    case 'payMethod': { const pm = nn(v); if (/مدد|mudad/.test(pm)) return 'مدد'; if (/دولي|international/.test(pm)) return 'تحويل دولي'; if (/نقد|cash/.test(pm)) return 'نقد'; if (/تحويل|bank|transfer/.test(pm)) return 'تحويل'; return ''; }
    default: return v;
  }
}
/** تحويل صف مُحلَّل إلى كائن form بنفس مفاتيح emptyForm (نموذج الموظف) */
export function toForm(r, emptyForm) {
  const f = emptyForm(); const isSa = isSaudiNat(r.nationality);
  const nature = r.contractNature || (r.contractDuration > 0 ? 'fixed' : 'indefinite');
  Object.assign(f, { na: r.nameAr || r.nameEn || '', ne: r.nameEn || '', empNo: r.empNo || '', em: r.employer || '', nat: r.nationality || (isSa ? 'سعودي' : ''), dep: r.dept || 'التشغيل', jt: r.jobTitle || '', dob: r.dob || '', mb: r.mobile || '', ml: r.email || '', bk: r.bank || '', ib: r.iban || '', sp: r.sponsor || '', rel: r.religion || 'مسلم',
    iq: r.iqamaNo || '', iqe: r.iqamaExpiry || '', pn: r.passportNo || '', ppe: r.passportExpiry || '', contractNature: nature, dur: nature === 'fixed' ? (r.contractDuration || '') : '', cj: r.contractJoin || '', ldc: r.leaveDaysContract || 21,
    sal: r.salary || 0, hou: r.housingAllowance || 0, tra: r.transportAllowance || 0, prj: r.projectAllowance || 0, oth: r.otherAllowance || 0, ded: r.otherDeductions || 0, extra: r.extraAllowance || 0,
    currency: r.currency || 'ريال سعودي', exchRate: r.exchRate > 0 ? r.exchRate : 1, insSystem: r.insSystem || (isSa ? 'old' : 'expat'), wpsType: r.wpsType || 'wps' });
  return f;
}
export const templateHead = () => FIELDS.map((f) => f.ar);
