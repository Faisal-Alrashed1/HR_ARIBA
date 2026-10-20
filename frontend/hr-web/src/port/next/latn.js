// ADAPTED (not in their source): the owner's rule — every number and date in English digits (0-9), never Arabic-Indic
// (٠-٩), whatever locale a screen passes ('ar-SA', 'ar-EG' …) or the browser's language. Patches the formatting entry
// points once so screens keep their locales (month / weekday names stay Arabic).
const KEY = '__aribaLatn';
if (typeof Intl !== 'undefined' && !globalThis[KEY]) {
  globalThis[KEY] = true;
  const latn = (o) => ({ ...(o || {}), numberingSystem: 'latn' });
  const wrap = (C) => {
    function F(l, o) { return new C(l, latn(o)); }
    F.prototype = C.prototype;
    F.supportedLocalesOf = C.supportedLocalesOf.bind(C);
    return F;
  };
  Intl.NumberFormat = wrap(Intl.NumberFormat);
  Intl.DateTimeFormat = wrap(Intl.DateTimeFormat);
  const num = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (l, o) { return num.call(this, l, latn(o)); };
  const big = typeof BigInt !== 'undefined' ? BigInt.prototype.toLocaleString : null;
  if (big) BigInt.prototype.toLocaleString = function (l, o) { return big.call(this, l, latn(o)); };
  for (const m of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
    const f = Date.prototype[m];
    Date.prototype[m] = function (l, o) { return f.call(this, l, latn(o)); };
  }
}
