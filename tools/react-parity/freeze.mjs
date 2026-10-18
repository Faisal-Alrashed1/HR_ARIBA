// Both systems read "today" from the clock; the run fixes it so results repeat (PARITY_NOW, local time).
// globalThis.__parityNow('YYYY-MM-DDTHH:MM:SS') moves the frozen clock for suites that sweep dates.
const RealDate = Date;
let fixed = new RealDate(process.env.PARITY_NOW || '2026-10-18T10:00:00').getTime();
class FrozenDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
  static now() { return fixed; }
}
globalThis.Date = FrozenDate;
globalThis.__parityNow = (s) => { fixed = new RealDate(s).getTime(); };
globalThis.__parityToday = () => { const d = new RealDate(fixed); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
