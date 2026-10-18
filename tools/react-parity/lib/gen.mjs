// Seeded generators: the same seed always gives the same cases.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    money: (lo, hi, step = 50) => Math.round((lo + next() * (hi - lo)) / step) * step,
    date: (y1, y2) => { const y = r.int(y1, y2), m = r.int(1, 12), d = r.int(1, new Date(y, m, 0).getDate()); return iso(y, m, d); },
  };
  return r;
}
export const p2 = (n) => (n < 10 ? '0' : '') + n;
export const iso = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
export const isoOf = (dt) => iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return isoOf(new Date(y, m - 1, d + n)); };

export const NATS = ['سعودي', 'سعودي', 'سعودي', 'مصري', 'هندي', 'أردني', 'سوداني', 'باكستاني'];
export const EMPLOYERS = ['أريبا للاستشارات', 'مشروع الرياض', 'وزارة الطاقة', 'برنامج تمهير', 'تدريب', 'هيئة السياحة'];
export const JOBS = ['محاسب', 'مهندس مدني', 'مدير مشروع', 'أخصائي موارد بشرية', 'استشاري أول', 'مستشار مالي', 'متدرب', 'مطور برمجيات', 'سكرتير'];
export const DEPTS = ['المالية', 'الموارد البشرية', 'المشاريع', 'تقنية المعلومات', 'تدريب', 'الإدارة'];
export const TERM_AR = ['اتفاق العامل وصاحب العمل على إنهاء العقد', 'انتهاء مدة العقد', 'فسخ العقد من قبل صاحب العمل لإحدى الحالات الواردة المادة (80)',
  'فسخ العقد من قبل صاحب العمل لغير الحالات الواردة في المادة (80)', 'بلوغ سن التقاعد / العجز / الوفاة', 'ترك العامل العمل للحالات الواردة في المادة (81)',
  'ترك العامل العمل دون تقديم استقالة لغير الحالات الواردة في المادة (81)', 'استقالة'];

/** One employee in the stored legacy `data` shape (employee_directory.data) — what both systems read. */
export function employee(r, id, opt = {}) {
  const nat = r.pick(NATS), saudi = nat === 'سعودي';
  const employer = r.chance(0.08) ? r.pick(['برنامج تمهير', 'تدريب']) : r.pick(EMPLOYERS.slice(0, 4).concat(EMPLOYERS.slice(5)));
  const job = r.chance(0.1) ? r.pick(['استشاري أول', 'مستشار مالي', 'متدرب']) : r.pick(JOBS);
  const sal = r.money(3000, 60000);
  const houPct = r.chance(0.6) ? 0.25 : r.pick([0, 0.2, 0.3, 0.4, 0.35]);
  const join = opt.join || r.date(2012, 2026);
  const term = opt.terminated ?? r.chance(0.12);
  const e = {
    id: String(id), empNo: String(id), nameAr: (r.chance(0.03) ? 'البوصيري ' : '') + r.pick(['محمد', 'أحمد', 'سارة', 'نورة', 'خالد', 'ريم', 'عبدالله', 'فاطمة']) + ' ' + r.pick(['العتيبي', 'القحطاني', 'الشهري', 'الحربي']),
    nationality: nat, isSaudi: saudi, dob: r.date(1960, 2003), gender: r.pick(['ذكر', 'أنثى', '']),
    employer, department: r.pick(DEPTS), jobTitle: job,
    wpsType: r.chance(0.07) ? r.pick(['consultant', 'tamheer', 'trainee', 'no_wps']) : 'wps',
    insSystem: r.chance(0.02) ? 'exempt' : saudi ? (r.chance(0.4) ? 'new' : 'old') : 'expat', excelCategory: r.chance(0.04) ? 'consultant' : '',
    empType: r.chance(0.8) ? 'active' : r.pick(['consultant', 'training', 'consultant_external', 'مهمة محددة', 'active']),
    contractJoin: join, contractNature: r.chance(0.7) ? 'fixed' : 'indefinite', contractDuration: r.pick([12, 24, 36, '']),
    leaveDaysContract: r.pick([21, 21, 21, 25, 30]),
    salary: sal, housingAllowance: Math.round(sal * houPct), transportAllowance: r.chance(0.7) ? Math.round(sal * 0.1) : r.money(0, 3000),
    projectAllowance: r.chance(0.2) ? r.money(500, 8000) : 0, otherAllowance: r.chance(0.2) ? r.money(100, 3000) : 0,
    extraAllowance: r.chance(0.1) ? r.money(100, 2000) : 0, otherDeductions: r.chance(0.1) ? r.money(50, 1500) : 0,
    currency: r.chance(0.08) ? 'دولار' : 'ريال سعودي', exchRate: 0, isTerminated: term, excludeFromPayroll: r.chance(0.03), isHourly: false,
    iqamaExpiry: r.chance(0.7) ? r.date(2026, 2028) : '', passportExpiry: r.chance(0.7) ? r.date(2026, 2030) : '', insuranceExpiry: r.chance(0.5) ? r.date(2026, 2027) : '',
  };
  if (r.chance(0.03)) { e.empType = 'hourly'; e.isHourly = true; }
  if (e.currency === 'دولار') e.exchRate = 3.755;
  if (e.contractNature === 'fixed' && e.contractDuration) { const [y, m, d] = join.split('-').map(Number); const t = new Date(y, m - 1 + Number(e.contractDuration), d - 1); e.contractEnd = isoOf(t); }
  if (r.chance(0.15)) e.probationEnd = addDays(join, r.int(60, 180));
  if (term) { e.terminationDate = r.date(Math.max(2020, +join.slice(0, 4)), 2026); if (e.terminationDate < join) e.terminationDate = addDays(join, r.int(30, 900)); e.terminationReason = r.pick(TERM_AR); }
  return e;
}
