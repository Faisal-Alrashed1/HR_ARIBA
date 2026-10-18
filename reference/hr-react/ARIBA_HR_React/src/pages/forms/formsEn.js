// النسخ الإنجليزية (يسار→يمين) لكل النماذج — منقولة من القديم V117. بتتبعت مع النموذج العربي بعد <!--ARIBA_EN-->
import { esc } from '../../lib/print.js';
import { wrap, CRIT } from './docs.js';
import { sigHtml } from '../../lib/hrSig.js';

const X = esc;
const DE = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleDateString('en-GB'); } catch { return String(v); } };
const LW = { m84: ['84', 'Termination by the Company'], m74: ['74', 'Mutual agreement'], m85: ['85', 'Resignation'], m75: ['75', 'Constructive resignation'], m77: ['77', 'Termination without valid reason'], m80: ['80', 'Disciplinary dismissal'], m74r: ['74(4)', 'Retirement'] };
const RATING = { 0: 'Unsatisfactory', 50: 'Below expectations', 70: 'Meets expectations', 90: 'Exceeds expectations', 100: 'Outstanding' };
const CRIT_EN = ['Technical knowledge in his/her field', 'Compliance with company rules and regulations', 'Quality of work output', 'Relationship with management and colleagues', 'Ability to learn, develop and take initiative'];

/** tr = دالة الترجمة (بعد loadTr). بترجّع { title, html } أو { err } */
export function buildEn(type, e, s, { settings, employees, tr }) {
  const en = (v) => (v && tr ? tr(v) : (v || ''));
  const nm = e.nameEn || en(e.nameAr) || '';
  const pE = (t) => '<p class="tf-p" dir="ltr" style="text-align:left;margin:1.5mm 0">' + t + '</p>';
  const bx = (t) => '<div class="tf-box" dir="ltr" style="text-align:left">' + t + '</div>';
  const sgn = (l, r, mt) => '<div class="tf-sign" dir="ltr" style="margin-top:' + (mt || 5) + 'mm"><div>' + l + '</div><div>' + r + '</div></div>';
  const HRS = (mt) => sigHtml(settings, employees, 'en', { date: true, h: 28, mt: typeof mt === 'number' ? mt : 2 }, tr);
  const ACK = (txt) => bx('I, ' + X(nm) + ', ' + txt) + sgn('Employee: ' + X(nm) + '<br>Signature: ________________', 'Date: ________________', 2);
  const info = () => { const c = (l, v) => '<td class="tf-lbl">' + l + '</td><td class="tf-val">' + X(v || '—') + '</td>';
    return '<div class="tf-info-title">Employee details</div><table class="tf-info"><tr>' + c('Name', nm) + c('Nationality', en(e.nationality || e.nat)) + '</tr><tr>' + c('ID / Iqama no.', e.iqamaNo || e.iqama) + c('Employee no.', e.empNo) + '</tr><tr>' + c('Department', en(e.department || e.dept)) + c('Job title', en(e.jobTitle || e.job)) + '</tr></table>'; };
  const W = (title, body) => ({ title, html: wrap(title, '', '<div dir="ltr" style="text-align:left">' + body + '</div>') });
  const j0 = e.contractJoin || e.join || '';
  switch (type) {
    case 'onboarding': {
      const mgr = s.mgr || e.manager || '—', join = s.join || j0, first = s.first !== false, lt = s.lvType;
      return W('Onboarding Notice', info() + bx('<b>Joining date:</b> ' + DE(join))
        + pE('Dear Sir/Madam, further to the employment notice, we inform you that the employee named above has commenced work at Ariba Business Solutions Company — ' + X(en(e.department || e.dept || '')) + ' department.')
        + pE('The employee commenced work on: <b>' + DE(join) + '</b>.') + sgn('Direct manager: ' + X(mgr) + '<br>Signature: ________________', 'Date: ' + DE(new Date()))
        + bx('<span class="tf-chk' + (first ? ' on' : '') + '"></span> First-time joining &nbsp;&nbsp;&nbsp; <span class="tf-chk' + (!first ? ' on' : '') + '"></span> Joining after returning from leave' + (lt ? ' (' + X(en(lt)) + ')' : ''))
        + HRS(4) + sgn('CEO approval<br>Signature: ________________', 'Date: ________________', 10));
    }
    case 'custody': {
      const rows = (s.items || []).filter((r) => String(r.n || '').trim()); if (!rows.length) return { err: 'Add at least one custody item' };
      return W('IT Custody Receipt', info() + '<table class="tf-bi"><tr><th style="width:8%">#</th><th>Item</th><th>Model / serial no.</th><th>Condition</th></tr>' + rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + X(r.n) + '</td><td>' + X(r.s || '—') + '</td><td>' + X(r.c || '—') + '</td></tr>').join('') + '</table>'
        + pE('I, the employee named above, acknowledge receiving the IT custody listed above from Ariba Business Solutions Company. I undertake to take care of it, use it for company work only and return it upon request or at the end of my service.')
        + sgn('Employee: ' + X(nm) + '<br>Signature: ________________', 'Date: ________________') + sgn('On behalf of IT Department<br>Signature: ________________', 'Date: ________________', 8));
    }
    case 'extension': {
      const join = s.join || j0, end = s.end; if (!end) return { err: 'Set the new extension end date' };
      return W('Probation Extension Notice', info() + bx('<div><b>Contract start date:</b> ' + DE(join) + '</div><div><b>Probation end date after extension:</b> ' + DE(end) + '</div>')
        + pE('Dear ' + X(nm) + ', greetings,') + pE('Referring to the employment contract concluded with you on ' + DE(join) + ', please be informed that your probation period has been extended to a further period ending on <b>' + DE(end) + '</b>.')
        + pE('Accordingly, kindly acknowledge receipt of this notice and return a signed copy to us.') + pE('With our best wishes for your success,') + HRS() + ACK('agree to the extension of the probation period as stated above.'));
    }
    case 'termination': {
      const join = s.join || j0, last = s.last; if (!last) return { err: 'Set the last working day' };
      return W('Probation Termination Notice', info() + bx('<div><b>Contract start date:</b> ' + DE(join) + '</div><div><b>Last working day:</b> ' + DE(last) + '</div>')
        + pE('Dear ' + X(nm) + ', greetings,') + pE('Referring to the employment contract concluded with you on ' + DE(join) + ', please be informed that your probation period is terminated, and your last working day under probation will be <b>' + DE(last) + '</b>.')
        + pE('Accordingly, kindly acknowledge receipt of this notice and return a signed copy to us.') + pE('With our best wishes for your success,') + HRS() + ACK('acknowledge receipt of the probation termination notice.'));
    }
    case 'clearance': {
      const join = s.join || j0, last = s.last, reason = s.reason || 'resign', other = s.other; if (!last) return { err: 'Set the last working day' };
      return W('Final Clearance', info() + bx('<div><b>Joining date:</b> ' + DE(join) + '</div><div><b>Last working day:</b> ' + DE(last) + '</div>')
        + bx('Clearance reason: <span class="tf-chk' + (reason === 'resign' ? ' on' : '') + '"></span> Resignation &nbsp;&nbsp; <span class="tf-chk' + (reason === 'end' ? ' on' : '') + '"></span> Contract end &nbsp;&nbsp; <span class="tf-chk' + (reason === 'other' ? ' on' : '') + '"></span> Other' + (reason === 'other' && other ? ': ' + X(other) : ''))
        + pE('We, Ariba Business Solutions Company, confirm that the employee named above has completed his/her work at the Company and handed over all custody in his/her possession, and has no dues or claims outstanding towards the Company.') + pE('Accordingly, the employee is hereby cleared.') + HRS(6));
    }
    case 'experience': {
      const start = s.start || j0, still = s.still !== false, end = s.end; let nature = s.nature || 'Full time'; const no = s.no || ('AR-' + (e.empNo || '') + '-' + new Date().getFullYear());
      nature = ({ 'دوام كامل': 'Full time', 'دوام جزئي': 'Part time', 'عقد مؤقت': 'Temporary contract' })[nature] || nature;
      return W('Experience Certificate', '<div class="meta-row"><div>Ref: ' + X(no) + '</div><div>Date: ' + DE(new Date()) + '</div></div>'
        + pE('Ariba Business Solutions Company certifies that Mr./Ms. <b>' + X(nm) + '</b>, ' + X(en(e.nationality || e.nat)) + ' national, ID no. (' + X(e.iqamaNo || e.iqama || '') + '), worked with us as (<b>' + X(en(e.job || e.jobTitle)) + '</b>) in the ' + X(en(e.department || e.dept || '')) + ' department.')
        + '<table class="tf-info"><tr><td class="tf-lbl">Contract type</td><td class="tf-val" colspan="3">Employment contract</td></tr><tr><td class="tf-lbl">Nature of contract</td><td class="tf-val" colspan="3">' + X(en(nature)) + '</td></tr><tr><td class="tf-lbl">Start date</td><td class="tf-val">' + DE(start) + '</td><td class="tf-lbl">End date</td><td class="tf-val">' + (still ? 'Still employed to date' : DE(end)) + '</td></tr></table>'
        + pE('During the period of employment he/she carried out the tasks assigned and was of good conduct.') + pE('We thank him/her for the efforts during that period and wish him/her every success.') + pE('This certificate was issued at his/her request without any liability on the Company.') + pE('Best regards,')
        + sigHtml(settings, employees, 'en', { mt: 5, h: 30 }, tr));
    }
    case 'evaluation': {
      const join = s.join || j0, end = s.end, rec = s.rec, dec = s.dec || '';
      const sc = CRIT.map((_, i) => Number((s.scores || [])[i]) || 0); const tot = Math.round(sc.reduce((a, b) => a + b, 0) / sc.length);
      return W('Probationary Period Evaluation', info() + bx('<b>Contract start date:</b> ' + DE(join) + ' &nbsp;&nbsp; <b>Probation end date:</b> ' + DE(end))
        + pE('The employee above is about to complete the probation period. Please complete this form and return it to Human Resources before it ends.')
        + '<table class="tf-eval"><tr><th>#</th><th>Criterion</th><th>Score</th><th>Rating</th></tr>' + CRIT_EN.map((c, i) => '<tr><td>' + (i + 1) + '</td><td style="text-align:left;padding-left:8px">' + c + '</td><td>' + sc[i] + '%</td><td>' + (RATING[sc[i]] || '') + '</td></tr>').join('') + '<tr style="font-weight:800;background:#f0f6f4"><td colspan="2">Total</td><td colspan="2">' + tot + '%</td></tr></table>'
        + bx('<b>Direct manager recommendations:</b> ' + X(rec || '') + '<div style="min-height:4mm"></div>')
        + bx('<b>Final decision:</b> &nbsp; <span class="tf-chk' + (dec === 'appoint' ? ' on' : '') + '"></span> Confirm employment &nbsp;&nbsp; <span class="tf-chk' + (dec === 'terminate' ? ' on' : '') + '"></span> Terminate &nbsp;&nbsp; <span class="tf-chk' + (dec === 'extend' ? ' on' : '') + '"></span> Extend probation')
        + sigHtml(settings, employees, 'en', { mt: 2, h: 27, extra: '<div style="text-align:center;font-weight:700;font-size:11.5px">Direct manager<br>Signature: ________________</div>' }, tr));
    }
    case 'contract_end': {
      const key = s.law, other = (s.other || '').trim(), last = s.last, join = s.join || j0, ref = s.ref, notes = (s.notes || '').trim();
      if (!last) return { err: 'Set the last working day' }; if (!key) return { err: 'Choose the legal basis' }; if (key === 'other' && !other) return { err: 'Enter the legal basis' };
      const basis = key === 'other' ? other : 'Article (' + LW[key][0] + ') of the Labor Law — ' + LW[key][1]; let r = '';
      if (ref) { if (key === 'm85' || key === 'm75') r = ', based on your resignation submitted on ' + DE(ref); else if (key === 'm74') r = ', based on the mutual agreement dated ' + DE(ref); }
      return W('Employment Contract Termination Notice', info() + bx('<div><b>Contract start date:</b> ' + DE(join) + '</div><div><b>Last working day:</b> ' + DE(last) + '</div><div><b>Legal basis:</b> ' + X(basis) + '</div>')
        + pE('Dear ' + X(nm) + ', greetings,') + pE('Referring to the employment contract concluded with you on ' + DE(join) + ', please be informed that your employment contract will be terminated with your last working day on <b>' + DE(last) + '</b>' + r + ', pursuant to <b>' + X(basis) + '</b>.') + (notes ? pE('<b>Notes:</b> ' + X(notes)) : '')
        + pE('Your statutory entitlements will be settled in accordance with the Labor Law. Accordingly, kindly acknowledge receipt of this notice and return a signed copy to us.') + pE('With our best wishes for your success,') + HRS() + ACK('acknowledge receipt of the employment contract termination notice.'));
    }
    default: return null;
  }
}
