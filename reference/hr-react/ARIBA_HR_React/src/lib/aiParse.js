// فهم أوامر مساعد اريبا بالعامية (منقول من V112): تواريخ، أوقات، مطابقة الموظف، نية الأمر
const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
export const N = (t) => digits(t).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').toLowerCase().replace(/\s+/g, ' ').trim();
const words = (t) => N(t).replace(/[،,؟?!؛"'()[\]]/g, ' ').replace(/\bعبد\s+/g, 'عبد').replace(/\bابو\s+/g, 'ابو').split(/\s+/).filter(Boolean);
const pad = (n) => ('0' + n).slice(-2);
export const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DAYNAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const showDate = (s) => { const p = s.split('-'); const d = new Date(+p[0], +p[1] - 1, +p[2]); return DAYNAMES[d.getDay()] + ' ' + (+p[2]) + '/' + (+p[1]) + '/' + p[0]; };
const DAYIDX = { الاحد: 0, الحد: 0, الاثنين: 1, الاتنين: 1, الثلاثاء: 2, الثلاث: 2, التلات: 2, التلاته: 2, الثلاثا: 2, الاربعاء: 3, الاربع: 3, الاربعا: 3, الخميس: 4, الجمعه: 5, السبت: 6 };
const MONTHS = { يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, مايو: 5, يونيو: 6, يوليو: 7, اغسطس: 8, سبتمبر: 9, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12 };

export function parseDates(text, past) {
  const t = N(text).replace(/(^|\s)لل(?=\S)/g, '$1ال').replace(/(^|\s)ل(ال\S+)/g, '$1$2').replace(/(^|\s)و(ال\S+)/g, '$1$2'), out = [], now = today(); let m;
  const push = (pos, d) => { if (d && !isNaN(d)) out.push({ pos, d: iso(d) }); };
  const re1 = /(\d{4})-(\d{1,2})-(\d{1,2})/g; while ((m = re1.exec(t))) push(m.index, new Date(+m[1], +m[2] - 1, +m[3]));
  const t2 = t.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/g, (x) => ' '.repeat(x.length));
  const re2 = /(^|[^\d:])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d:])/g;
  while ((m = re2.exec(t2))) { const y = m[4] ? (+m[4] < 100 ? 2000 + (+m[4]) : +m[4]) : now.getFullYear(); push(m.index + m[1].length, new Date(y, +m[3] - 1, +m[2])); }
  const re3 = /(\d{1,2})\s*(يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)(?:\s*(\d{4}))?/g;
  while ((m = re3.exec(t))) push(m.index, new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS[m[2]] - 1, +m[1]));
  const rel = [[/بعد بكر[هاة]/g, 2], [/(^|\s)(النهارد[هة]|اليوم|انهارد[هة])(\s|$)/g, 0], [/(^|\s)(امبارح|امس|البارحه)(\s|$)/g, -1], [/(^|\s)(بكر[هاة]|بكرا|غدا|الغد)(\s|$)/g, 1]];
  let used = t;
  rel.forEach((r) => { let mm; r[0].lastIndex = 0; while ((mm = r[0].exec(used))) { push(mm.index, addDays(now, r[1])); used = used.slice(0, mm.index) + ' '.repeat(mm[0].length) + used.slice(mm.index + mm[0].length); r[0].lastIndex = 0; } });
  Object.keys(DAYIDX).forEach((k) => {
    const re = new RegExp('(^|\\s)(يوم\\s+)?' + k + '(\\s|$)', 'g'); let mm;
    while ((mm = re.exec(t))) { const diff = past ? -((now.getDay() - DAYIDX[k] + 7) % 7) : (DAYIDX[k] - now.getDay() + 7) % 7; push(mm.index, addDays(now, diff)); }
  });
  out.sort((a, b) => a.pos - b.pos);
  const seen = {}, res = []; out.forEach((o) => { if (!seen[o.pos]) { seen[o.pos] = 1; res.push(o.d); } });
  return res;
}
export const parseDuration = (text) => { const m = N(text).match(/(\d+)\s*(يوم|ايام|يوما)/); return m ? +m[1] : 0; };
export function parseTime(text) {
  const t = N(text); let m;
  if ((m = t.match(/(\d{1,2}):(\d{2})/))) return pad(+m[1]) + ':' + m[2];
  if ((m = t.match(/الساع[هة]\s*(\d{1,2})(?:[.](\d{2}))?(\s*(ونص|و نص|وربع|و ربع|الا ربع|الا ربع))?/))) {
    let h = +m[1], mi = m[2] ? +m[2] : 0; const x = m[4] || '';
    if (/نص/.test(x)) mi = 30; else if (/الا ربع/.test(x)) { h -= 1; mi = 45; } else if (/ربع/.test(x)) mi = 15;
    return pad(h) + ':' + pad(mi);
  }
  return '';
}
const isTerm = (e) => !!(e.isTerminated || e.term);
export { isTerm };
const nameTokens = (e) => words(e.nameAr).filter((w) => w !== 'بن' && w !== 'بنت' && w !== 'ابن');
export function findEmployees(text, emps) {
  const t = N(text); let m;
  if ((m = t.match(/(?:emp|رقم|الرقم الوظيفي)\s*0*(\d{1,5})/i))) { const byNo = emps.filter((e) => String(e.empNo || '').replace(/^0+/, '') === m[1]); if (byNo.length) return byNo; }
  const cmd = words(text);
  const scored = emps.map((e) => {
    const nt = nameTokens(e), set = {}; nt.forEach((w) => { set[w] = 1; });
    let score = 0, first = false; const hits = [];
    cmd.forEach((w) => {
      let w2 = w; if (!set[w2] && w2.length > 3 && w2[0] === 'ل' && set[w2.slice(1)]) w2 = w2.slice(1);
      if (!set[w2] && w2.length > 3 && w2.indexOf('وال') === 0 && set[w2.slice(1)]) w2 = w2.slice(1);
      if (set[w2] && w2.length >= 2 && hits.indexOf(w2) < 0) { hits.push(w2); score++; if (w2 === nt[0]) first = true; }
    });
    return { e, score, first };
  }).filter((x) => x.score > 0 && (x.first || x.score >= 2));
  if (!scored.length) return [];
  const best = Math.max(...scored.map((x) => x.score)); const top = scored.filter((x) => x.score === best);
  const act = top.filter((x) => !isTerm(x.e));
  if (act.length === 1 && top.length > 1 && best >= 2) return [act[0].e];
  return top.map((x) => x.e);
}
const LEAVE_TYPES = [['مرضي', 'sick'], ['اضطرار', 'emergency'], ['وفا', 'death'], ['زواج', 'marriage'], ['ابو', 'paternity'], ['امومه', 'maternity'], ['عمره', 'umrah'], ['حج', 'hajj'], ['عن بعد', 'remote'], ['سنوي', 'annual']];
export const PAGE_WORDS = [[/لوحه التحكم|الرئيسيه|الداشبورد/, 'dash'], [/مسير|الرواتب|payroll/, 'pay'], [/كشف (ال)?راتب/, 'slip'], [/الموظفين|الموظفون/, 'emps'], [/المرشحين|المرشحون|التوظيف/, 'cand'], [/المستهدفات|الاهداف/, 'goals'], [/التقييم/, 'eval'], [/الحضور|البصمه/, 'att'], [/مواقع/, 'loc'], [/الاجازات|الطلبات/, 'lv'], [/الفريق|المهام/, 'team'], [/التامينات/, 'insc'], [/حاسبه (ال)?راتب/, 'salcalc'], [/الضريبه/, 'taxcalc'], [/تحويل (ال)?رواتب|wps/, 'wps'], [/المخصصات/, 'prov'], [/الاصول|العهد/, 'assets'], [/نهايه (ال)?خدمه/, 'eos'], [/المخالصه/, 'eoscalc'], [/الوثائق|الاقامات/, 'docs'], [/التقارير|تقرير/, 'rpt'], [/الاعدادات/, 'set'], [/سجل (ال)?تعديلات/, 'audit'], [/النماذج/, 'forms']];
export function understand(text) {
  const t = N(text), has = (re) => re.test(t);
  if (has(/(ابعت|ارسل|بعت|وجه|اكتب|ابلغ)\S*/) && has(/رساله|رسايل|اشعار|تنبيه|تذكير|ابلاغ/)) return { kind: 'msg' };
  if (has(/^(افتح|افتحلي|روح|اذهب|وديني|وريني|ورني|عايز اشوف|اعرض)/) && !has(/نموذج|مخالص|شهاد|اخلاء|مباشر|عهده|انهاء|تمديد/)) { const pg = PAGE_WORDS.find((x) => x[0].test(t)); if (pg && !has(/كشف (ال)?راتب/)) return { kind: 'nav', page: pg[1] }; }
  if (has(/(كم|كام|عدد) .*(موظف|موظفين)/) || has(/^عدد (ال)?موظف/)) return { kind: 'stat', q: 'headcount' };
  if (has(/(اجمالي|مجموع|تكلف[هة]) (ال)?(رواتب|مرتبات|راتب)/)) return { kind: 'stat', q: 'payroll' };
  if (has(/(اقام|هويه|وثائق).*(تنتهي|منتهي|قرب|منتهيه|قاربت)|(تنتهي|منتهي|قرب).*(اقام|هويه)/) && !has(/رقم/)) return { kind: 'stat', q: 'iqama' };
  if (has(/(عقود|عقد).*(تنتهي|منتهي|قرب|قاربت)|(تنتهي|منتهي).*عقود/)) return { kind: 'stat', q: 'contract' };
  if (has(/(مين|من هم|اسماء|قائم[هة]) .*(اجاز[هة]|اجازه)|في اجاز[هة] (النهارد|اليوم)/) && !has(/رصيد/)) return { kind: 'stat', q: 'onleave' };
  if (has(/(قسم|اقسام|ادارات)/) && has(/كم|كام|عدد|توزيع/)) return { kind: 'stat', q: 'dept' };
  if (has(/(جنسي|سعودي|مقيم)/) && has(/كم|كام|عدد|توزيع/)) return { kind: 'stat', q: 'nat' };
  if (has(/(اعرض|اسماء|قائم[هة]|كل) (ال)?(موظفين|موظفون)/)) return { kind: 'stat', q: 'list' };
  if (has(/كلم[هة] (ال)?مرور|باسورد|باسوورد|الرقم السري|كلمه السر|password/)) {
    if (has(/مين|لسه|قائم[هة]|الافتراضي|ماغير|مغيرش/) && !has(/تعيين|ريست|reset|جديد[هة]|نسي/)) return { kind: 'pwlist' };
    return { kind: 'reset' };
  }
  if (has(/مخالص|تصفي[هة]|نهاي[هة] (ال)?خدم[هة]|مكافا[هة] نهاي[هة]/) && !has(/انهاء (ال)?خدم|انهاء (ال)?عقد/)) return { kind: 'settlement' };
  if (has(/اخلاء( ال)? ?طرف|اخلاء/)) return { kind: 'form', form: 'clearance' };
  if (has(/انهاء (ال)?خدم|انهاء (ال)?عقد|انذار/)) return { kind: 'form', form: 'termination' };
  if (has(/مباشر/)) return { kind: 'form', form: 'onboarding' };
  if (has(/خبر[هة]/)) return { kind: 'form', form: 'experience' };
  if (has(/تمديد|تجديد/)) return { kind: 'form', form: 'extension' };
  if (has(/عهد[هة]/)) return { kind: 'form', form: 'custody' };
  if (has(/تقييم/)) return { kind: 'form', form: 'evaluation' };
  if (has(/كشف (ال)?راتب|قسيم[هة]|مفردات (ال)?راتب/)) return { kind: 'payslip' };
  if (has(/اجاز[هة]|اجازات/) && !has(/رصيد/)) { let type = 'annual'; LEAVE_TYPES.forEach((p) => { if (t.indexOf(p[0]) >= 0 && type === 'annual') type = p[1]; }); return { kind: 'leave', type }; }
  if (has(/غياب|غايب|غائب|(^|\s)غاب(\s|$)|مجاش|ماجاش|لم يحضر/)) return { kind: 'att', status: 'absent' };
  if (has(/متاخر|تاخر|تاخير/)) return { kind: 'att', status: 'late' };
  if (has(/عن بعد|ريموت/)) return { kind: 'att', status: 'remote' };
  if (has(/حضور|حاضر|(^|\s)حضر(\s|$)|(^|\s)(جه|جا|جاء|وصل)(\s|$)/)) return { kind: 'att', status: 'present' };
  if (has(/رصيد/)) return { kind: 'q', q: 'balance' };
  if (has(/راتب|مرتب/)) return { kind: 'q', q: 'salary' };
  if (has(/اقام[هة]/)) return { kind: 'q', q: 'iqama' };
  if (has(/عقد/)) return { kind: 'q', q: 'contract' };
  return { kind: 'unknown' };
}
export const SETTLE_REASONS = [[/استقال/, 'm85'], [/اتفاق|تراضي/, 'm74'], [/تقاعد/, 'm74r'], [/وفا/, 'm74d'], [/تجرب/, 'm53'], [/تاديب|فصل/, 'm80'], [/تعسف/, 'm77'], [/قسري/, 'm75']];
