// مخالصة نهاية خدمة رسمية (صفحة واحدة) — منقولة من V68/V69 في النسخة القديمة
import { esc } from './print.js';
import { tafqeet } from './tafqeet.js';
const fD = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn'); } catch { return v; } };
const n2 = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const CO = 'شركة حلول أريبا لخدمات الأعمال';
const CSS = '<style>*{box-sizing:border-box}body{font-family:"ARIBA Two","Segoe UI",Tahoma,Arial,sans-serif;color:#1a1a1a;line-height:1.5;font-size:13.5px;margin:0}'
  + '.doc{width:100%;max-width:210mm;margin:0 auto;padding:0 14mm}.hd{text-align:center;padding-bottom:4px;margin-bottom:8px}.hd .co{font-size:17px;font-weight:900;color:#014D3D}.hd .ti{font-size:14px;color:#444;margin-top:2px;font-weight:700}'
  + '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;background:#f7f9f8;border:1px solid #e0e4e2;border-radius:8px;padding:10px 14px;margin-bottom:10px}.info-grid div{font-size:12.5px}.info-grid b{color:#014D3D}'
  + 'h3.sec{color:#014D3D;border-bottom:1.5px solid #014D3D;padding-bottom:3px;margin:9px 0 5px;font-size:14px;page-break-after:avoid}table.doc-table{width:100%;border-collapse:collapse;margin-top:4px;font-size:12px;page-break-inside:avoid}'
  + 'table.doc-table th{background:#014D3D;color:#fff;padding:5px 10px;text-align:right;font-size:12px}table.doc-table td{padding:4px 10px;border-bottom:1px solid #e0e4e2}'
  + '.legal{font-size:12px;text-align:justify;margin-top:6px;line-height:1.42}.legal>.intro{margin-bottom:6px}.legal ul{padding-right:20px;margin:0}.legal li{margin-bottom:6px}.legal>.outro{margin-top:6px;font-weight:700;text-align:center}'
  + '.sign{display:flex;justify-content:space-between;margin-top:14px;font-size:12.5px}.sign div{width:45%;border-top:1px solid #333;padding-top:4px;text-align:center}</style>';

/** e: الموظف، p: مدخلات الشاشة، R: نتيجة settle() */
export function buildSettlementHtml(e, p, R, { eosLabel = '', lawNote = '' } = {}) {
  const net = R.total, taf = tafqeet(net);
  const end = p.end ? new Date(p.end) : null; let period = null;
  if (end) { let ps = new Date(end.getFullYear(), end.getMonth(), 1); if (p.start) { const s2 = new Date(p.start); if (ps < s2) ps = s2; } period = { from: ps, to: end, days: Math.round((end - ps) / 86400000) + 1 }; }
  const pt = period ? fD(period.from) + ' إلى ' + fD(period.to) + ' (' + period.days + ' يوم)' : '—';
  const sec = (t) => '<tr><td colspan="3" style="background:#e8f0ee;color:#014D3D;font-weight:800;padding:3px 7px;font-size:11px">' + t + '</td></tr>';
  const row = (a, b, c, col) => '<tr><td>' + esc(a) + '</td><td style="color:#666">' + esc(b || '') + '</td><td style="text-align:left;font-weight:700;color:' + (col || '#1a1a1a') + '">' + esc(c) + '</td></tr>';
  let rows = '';
  rows += sec('مدة الخدمة') + row('من ' + fD(p.start) + ' إلى ' + fD(p.end), R.dur.fy + ' سنة ' + R.dur.fm + ' شهر ' + R.dur.fd + ' يوم', '');
  rows += sec('مكافأة نهاية الخدمة' + (eosLabel ? ' (' + eosLabel + ')' : '')) + row('المستحق نظاماً', lawNote, R.ef > 0 ? n2(R.ef) + ' ر.س' : 'لا تستحق', R.ef > 0 ? '#0a7a3f' : '#c0392b');
  rows += sec('بدل الإجازة') + row('الرصيد المتبقي: ' + R.lrem + ' يوم', '', n2(R.lcomp) + ' ر.س', '#0a7a3f');
  if (R.lexc > 0) rows += row('إجازة زائدة عن المستحق: ' + R.lexc + ' يوم', 'المستحق ' + R.ldue + ' يوم — المأخوذ ' + p.taken + ' يوم', '-' + n2(R.lded) + ' ر.س', '#c0392b');
  rows += sec('راتب آخر فترة عمل') + row(pt, '', n2(R.lmsf) + ' ر.س', '#0a7a3f');
  const ex = (p.extras || []).filter((x) => Number(x.v)); if (ex.length) { rows += sec('استحقاقات إضافية'); ex.forEach((x) => { rows += row(x.n || 'استحقاق', '', '+' + n2(x.v) + ' ر.س', '#0a7a3f'); }); }
  rows += sec('الاستقطاعات'); const ds = (p.deds || []).filter((x) => Number(x.v));
  if (ds.length) ds.forEach((d) => { const raw = Number(d.v), amt = d.t === 'days' ? Math.round(((Number(p.sal) || 0) / (Number(p.wd) || 30)) * raw * 100) / 100 : raw; const ins = /تأمين/.test(d.n || '');
    rows += ins ? row('التأمينات الاجتماعية (GOSI)', 'عن الفترة: ' + pt, '-' + n2(amt) + ' ر.س', '#c0392b') : row(d.n || 'استقطاع', d.t === 'days' ? raw + ' يوم' : 'استقطاع مالي', '-' + n2(amt) + ' ر.س', '#c0392b'); });
  else rows += row('لا توجد استقطاعات', '', '—', '#888');
  rows += '<tr style="background:#014D3D"><td colspan="2" style="color:#fff;font-weight:900;padding:6px 8px;font-size:12.5px">صافي مبلغ المخالصة المستحق</td><td style="color:#fff;font-weight:900;text-align:left;padding:6px 8px;font-size:13.5px">' + n2(net) + ' ر.س</td></tr>';
  rows += '<tr><td colspan="3" style="background:#f7f9f8;text-align:center;font-size:11px;padding:4px 7px;color:#014D3D">فقط: ' + esc(taf) + '</td></tr>';
  const isAriba = /اريبا|أريبا/.test(e.employer || '');
  const custody = isAriba ? '<li>أقرّ بأنني سلّمت جميع العهد والأجهزة والمستندات التابعة للشركة والتي كانت لدي أثناء فترة عملي، ولا أحتفظ بأي منها أو بنسخ عنها.</li>'
    : '<li>أقر بتسليم جميع العهد التي استلمتها من ' + esc(e.employer || '') + '، والتي استخدمتها في أعمال المشروع والتي تعهدت بالمحافظة عليها.</li>';
  const nat = e.nationality || '', iq = e.iqamaNo || '', nm = e.nameAr || '';
  return CSS + '<div class="doc"><div class="hd"><div class="co">' + CO + '</div><div class="ti">مخالصة نهاية خدمة — إقرار واستلام مستحقات</div></div>'
    + '<div class="info-grid"><div><b>الاسم:</b> ' + esc(nm || '—') + '</div><div><b>الجنسية:</b> ' + esc(nat || '—') + '</div><div><b>رقم الهوية/الإقامة:</b> ' + esc(iq || '—') + '</div><div><b>الرقم الوظيفي:</b> ' + esc(e.empNo || '—') + '</div><div><b>الوظيفة:</b> ' + esc(e.jobTitle || '—') + '</div><div><b>جهة العمل:</b> ' + esc(e.employer || '—') + '</div></div>'
    + '<table class="doc-table"><tr><th>البيان</th><th>التفاصيل</th><th>المبلغ</th></tr>' + rows + '</table><h3 class="sec">إقرار وتعهد</h3>'
    + '<div class="legal"><div class="intro">أنا الموقع أدناه / ' + esc(nm) + '، ' + esc(nat) + ' الجنسيــة – هــوية وطنيــة رقم (' + esc(iq) + ')، أقر بموجب هذا بالآتي:</div><ul>'
    + '<li>أقر باستلامي كامل حقوقي ومستحقاتي القانونية بموجب عقد العمل الخاص بي وذلك عن مدة خدمتي مع ' + CO + '، كما هو منصوص عليه في نظام العمل السعودي والتي انتهت مع الشركة بتاريخ (' + fD(p.end) + ')م.</li>'
    + '<li>أوافق على تحويــل مســتحقاتي المتبقية لدي ' + CO + ' بمبلغ إجمالي قدرة (' + esc(taf) + ') إلى حســابي الشخصـي فـي (' + esc(e.bank || '—') + ') رقم (' + esc(e.iban || '—') + ').</li>'
    + '<li>أقر بأنني بموجب هذا ابرئ، بصفة نهائية وغير قابلة للنقض والرجوع عنها، ' + CO + '، ويشمل مالكيها ومديريها وموظفيها وعملائها من أي مستحقات أو مطالبات أو التزامات مالية او إجراءات أو حقوق أو دعاوي أو التزامات أو مسؤوليات قانونية سواء كانت حالية او مستقبلية من أي نوع كانت والتي يمكن ان تنشأ من أو تكون مرتبطة أو متعلقة بتوظيفي بأي طريقة سواء مباشرة أو غير مباشرة.</li>'
    + custody + '<li>اقر بان جميع المعلومات والمستندات التي نمت إلى علمي أو في حوزتي بسبب أو أثناء توظيفي وعملي هي سرية تماما وأوافق على عدم إفشاء محتوياتها لأي طرف من الغير الا إذا كان ذلك لازماً بمقتضى القوانين في المملكة العربية السعودية، كما اتعهد بعدم استخدامها لحسابي أو لصالحي الخاص أو لحساب أي جهة عمل لديها في المستقبل.</li>'
    + '</ul><div class="outro">وهذا تعهد ومخالصة نهائية وغير قابلة للنقض.</div></div><div class="sign"><div>الاسم: ' + esc(nm) + '</div><div>التوقيع: ________________</div></div></div>';
}
