// محرك ترجمة النصوص العربية للإنجليزي (منقول من القديم V117) — القاموس بيتحمّل عند أول استخدام
let loaded = false, loading = null;
var AR=/[\u0600-\u06FF]/, DICT=Object.create(null), keysSorted=null, memo=Object.create(null);
  
  function western(s){ return s.replace(/[\u0660-\u0669]/g,function(d){ return '0123456789'.charAt('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)); }).replace(/\u066C/g,',').replace(/\u066B/g,'.'); }
  function isEnMode(){ try{ if(typeof window.ARIBA_UI_LANG==='function') return window.ARIBA_UI_LANG()==='en'; }catch(e){} try{ return typeof LANG!=='undefined'&&LANG==='en'; }catch(e){} return false; }
  function esc2(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function phraseSub(s){
    if(!keysSorted){ keysSorted=Object.keys(DICT).filter(function(k){ return k.length>=5 && AR.test(k) && /\s/.test(k.trim()) ; }).sort(function(a,b){ return b.length-a.length; }); }
    var out=s;
    for(var i=0;i<keysSorted.length && AR.test(out);i++){
      var k=keysSorted[i]; if(out.indexOf(k)<0) continue;
      out=out.replace(new RegExp('(^|[^\\u0600-\\u06FF])'+esc2(k)+'(?![\\u0600-\\u06FF])','g'),function(m,p){ return p+DICT[k]; });
    }
    return out;
  }
  /* ترجمة كلمة بكلمة بشرط إن كل الكلمات العربية موجودة في القاموس (عشان ما يطلعش نص نصه عربي ونصه إنجليزي) */
  function tokenTr(core){
    var parts=core.split(/(\s+)/), out=[], i=0;
    var words=[], seps=[]; parts.forEach(function(p,idx){ if(idx%2===0) words.push(p); else seps.push(p); });
    while(i<words.length){
      var w=words[i]; if(!AR.test(w)){ out.push(w); i++; continue; }
      var done=false;
      for(var n=Math.min(4,words.length-i); n>=1 && !done; n--){
        var span=words.slice(i,i+n).join(' '), bare=span.replace(/^[\s.,;:!?()\[\]"'\u00AB\u00BB\u060C\u061B\u061F\-\u2014\u2022|\/]+|[\s.,;:!?()\[\]"'\u00AB\u00BB\u060C\u061B\u061F\-\u2014\u2022|\/]+$/g,''), pre=span.slice(0,span.indexOf(bare)), post=span.slice(span.indexOf(bare)+bare.length);
        if(DICT[bare]!==undefined){ out.push(pre.replace('،',',')+DICT[bare]+post.replace('،',',')); i+=n; done=true; }
      }
      if(!done) return null;
    }
    var res=''; out.forEach(function(o,idx){ res+=o+(idx<out.length-1?' ':''); }); return res;
  }
  function trCore(core){
    var m;
    if(DICT[core]!==undefined) return DICT[core];
    if((m=core.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*([صم])$/))) return m[1]+' '+(m[2]==='ص'?'AM':'PM');
    if(core.length===1&&AR.test(core)){ var LET={'ا':'A','أ':'A','إ':'I','آ':'A','ب':'B','ت':'T','ث':'T','ج':'J','ح':'H','خ':'K','د':'D','ذ':'D','ر':'R','ز':'Z','س':'S','ش':'S','ص':'S','ض':'D','ط':'T','ظ':'Z','ع':'A','غ':'G','ف':'F','ق':'Q','ك':'K','ل':'L','م':'M','ن':'N','ه':'H','و':'W','ي':'Y'}; if(LET[core]) return LET[core]; }
    /* "عربي / English": نأخذ الجزء الإنجليزي */
    if((m=core.match(/^(.*[\u0600-\u06FF].*?)\s*\/\s*([A-Za-z][A-Za-z0-9 \/&().,'\-]*)$/))) return (m[1].match(/^[^\u0600-\u06FFA-Za-z0-9]*/)[0]||'')+m[2];
    if((m=core.match(/^([A-Za-z][A-Za-z0-9 \/&().,'\-]*?)\s*\/\s*[\u0600-\u06FF].*$/))) return m[1];
    if((m=core.match(/^([\d.,]+)\s*ر\.?س\.?$/))) return m[1]+' SAR';
    if((m=core.match(/^(\d+)\s*سنة\s*(\d+)\s*شهر\s*(\d+)\s*يوم$/))) return m[1]+'y '+m[2]+'m '+m[3]+'d';
    if((m=core.match(/^([\d.]+)\s*سنة$/))) return m[1]+' yrs';
    if((m=core.match(/^([\d.]+)\s*يوم$/))) return m[1]+(m[1]==='1'?' day':' days');
    if((m=core.match(/^([\d.]+)\s*ساعة$/))) return m[1]+' h';
    if((m=core.match(/^\(?(\d+)\s*موظف\)?$/))) return m[1]+(m[1]==='1'?' employee':' employees');
    if((m=core.match(/^(.*?)\s*\((\d+)\s*موظف\)$/))) return trCore(m[1])+' ('+m[2]+' employees)';
    if((m=core.match(/^رقم وظيفي:\s*(.*)$/))) return 'Emp. no: '+m[1];
    if((m=core.match(/^(\d+)\s*سعودي\s*[•·]\s*(\d+)\s*وافد$/))) return m[1]+' Saudi • '+m[2]+' expat';
    if((m=core.match(/^([\d.]+)%\s*(ذكور|إناث)$/))) return m[1]+'% '+(m[2]==='ذكور'?'male':'female');
    var pre=(core.match(/^[^\u0600-\u06FFA-Za-z0-9(]+/)||[''])[0];
    if(pre){ var rest=core.slice(pre.length); if(DICT[rest]!==undefined) return pre+DICT[rest]; }
    if((m=core.match(/^إصدار\s+(.*)$/))) return 'Version '+m[1];
    if((m=core.match(/^من\s*(\d+)$/))) return 'of '+m[1];
    if((m=core.match(/^م(\d+)$/))) return 'M'+m[1];
    if((m=core.match(/^(.*?)\s*\|\s*النطاق:\s*(.*)$/))) return m[1]+' | Radius: '+m[2];
    var tk=tokenTr(core); if(tk!==null) return tk;
    return phraseSub(core);
  }
  function tr(s){
    if(s==null) return s; s=String(s);
    if(!AR.test(s) && !/[\u0660-\u0669]/.test(s)) return s;
    if(memo[s]!==undefined) return memo[s];
    var lead=s.match(/^\s*/)[0], trail=s.match(/\s*$/)[0], core=western(s.trim());
    var out=AR.test(core)?trCore(core):core;
    return (memo[s]=lead+out+trail);
  }
  
const EXTRA = {
  'تطبيق الموظف | Employee App': 'Employee App',
  '🎯 مستهدفاتي': '🎯 My targets',
  '⭐ تقييماتي': '⭐ My evaluations',
  'مستهدفاتي': 'My targets',
  'تقييماتي': 'My evaluations',
  'لا توجد مستهدفات حالياً': 'No targets at the moment',
  'لا توجد تقييمات معتمدة بعد': 'No approved evaluations yet',
  'لا مستهدفات': 'No targets',
  'لا مستهدفات للفترة': 'No targets for this period',
  'المطلوب': 'Target',
  'المنجز': 'Achieved',
  'المنجز حتى الآن': 'Achieved so far',
  'الوزن': 'Weight',
  'الوزن (الأهمية)': 'Weight (importance)',
  'الدرجة': 'Score',
  'الحالة': 'Status',
  'العنوان': 'Title',
  'الوصف': 'Description',
  'القيمة المستهدفة': 'Target value',
  'الوحدة (عميل، ريال، %…)': 'Unit (clients, SAR, %…)',
  'النتيجة الإجمالية': 'Overall result',
  'بانتظار الاعتماد': 'Pending approval',
  'بند يدوي': 'Manual item',
  'تعديل': 'Edit',
  'تعديل مستهدف': 'Edit target',
  'حذف': 'Delete',
  'حفظ': 'Save',
  'حفظ كمسودة': 'Save as draft',
  'إرسال للاعتماد': 'Send for approval',
  'إلغاء': 'Cancel',
  'مستهدف جديد': 'New target',
  'مسودة': 'Draft',
  'معتمد': 'Approved',
  'منجز': 'Done',
  'نشط': 'Active',
  'حذف المستهدف؟': 'Delete this target?',
  'اكتب عنوان المستهدف': 'Enter the target title',
  'حُفظ المستهدف': 'Target saved',
  'حُفظت المسودة': 'Draft saved',
  'أُرسل التقييم للاعتماد': 'Evaluation sent for approval',
  'اعتماد نهائي وإبلاغ الموظف': 'Final approval and notify the employee',
  'التقييم معتمد ومُبلَّغ للموظف': 'Evaluation approved and the employee was notified',
  'تعذر الاعتماد': 'Could not approve',
  'تعذر التحميل': 'Could not load',
  'تعذر الحفظ': 'Could not save',
  'اعتماد التقييم نهائياً؟ سيصل الموظف إشعار وإيميل بالنتيجة': 'Approve the evaluation as final? The employee will receive a notification and an email with the result',
  'ملاحظات عامة (تصل للموظف مع النتيجة)': 'General comments (sent to the employee with the result)',
  'ملاحظة على البند (اختياري)': 'Item comment (optional)',
  'عنوان البند': 'Item title',
  'مستهدفات أخرى هذا العام': 'Other targets this year',
  'الربع': 'Quarter',
  'السنة': 'Year',
  'الشهر': 'Month',
  'نتائج تقييماتي المعتمدة': 'My approved evaluation results',
  'أضف مستهدفات من تبويب المستهدفات أو أضف بنداً يدوياً': 'Add targets from the Targets tab or add a manual item',
  'تقييم موظف: يجلب مستهدفاته تلقائياً للفترة، ثم يقيَّم كل بند؛ حفظ مسودة ← إرسال للاعتماد ← اعتماد نهائي': 'Employee evaluation: loads the period targets automatically, then each item is scored; save draft → send for approval → final approval', 'تصدير هذه الصفحة (Excel / PDF / Word / إيميل)': 'Export this page (Excel / PDF / Word / Email)', 'وافد': 'Expat', 'ذكور': 'Male', 'إناث': 'Female', 'منتهية الخدمة': 'Terminated', 'إعادة تفعيل': 'Reactivate',
  'اعتماد الطلب نهائياً بالنيابة عن كل المراحل المتبقية': 'Final approval on behalf of all remaining stages', 'تنسخ Working days لأيام التأمينات لكل الموظفين': 'Copy working days to insurance days for all employees', 'ترجع Insurance days لأيام الشهر لكل الموظفين': 'Reset insurance days to month days for all employees',
  'رصيد نهاية العام': 'Year-end balance', 'الفائض المتوقع هذا العام (يضاف نهاية الخدمة)': 'Expected excess this year (added at year end)', 'إرسال إيميل للموظف': 'Email to employee', 'طباعة مخالصة رسمية': 'Official settlement form', 'بريدي أنا': 'My mailbox' };
export async function loadTr() {
  if (loaded) return tr;
  if (!loading) loading = import('./trDict.js').then((m) => { m.default.split('\n').forEach((l) => { const i = l.indexOf('|'); if (i > 0) DICT[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }); Object.assign(DICT, EXTRA); keysSorted = null; Object.keys(memo).forEach((k) => delete memo[k]); loaded = true; return tr; });
  return loading;
}
export { tr };
