// Comparison helpers: a value matches when both are empty/NaN, equal strings, or numbers within half a halala.
export const TOL = 0.006;
const empty = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
export function same(a, b) {
  if (empty(a) && empty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a), y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Object.is(x, y);
    return Math.abs(x - y) <= TOL;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  return String(a ?? '') === String(b ?? '');
}

/** A suite's tally: cases, cases with any difference, per-field counts, per-cause counts and a few samples. */
export class Tally {
  constructor(id, title, rows) { Object.assign(this, { id, title, rows, cases: 0, diffCases: 0, fields: {}, causes: {}, samples: [], notes: [], rowCases: {}, rowDiffs: {} }); }
  /** rowOf: field → comparison-file row (object or function); every compared field marks its row as tested. */
  add(theirs, ours, fields, input, causeFn, rowOf) {
    this.cases++;
    const bad = fields.filter((f) => !same(theirs?.[f], ours?.[f]));
    if (rowOf) {
      const rowFor = (f) => (typeof rowOf === 'function' ? rowOf(f, input) : rowOf[f]);
      const seen = new Set(), hit = new Set();
      fields.forEach((f) => { const r = rowFor(f); if (r != null) [].concat(r).forEach((x) => seen.add(x)); });
      bad.forEach((f) => { const r = rowFor(f); if (r != null) [].concat(r).forEach((x) => hit.add(x)); });
      seen.forEach((x) => { this.rowCases[x] = (this.rowCases[x] || 0) + 1; });
      hit.forEach((x) => { this.rowDiffs[x] = (this.rowDiffs[x] || 0) + 1; });
    }
    if (!bad.length) return false;
    this.diffCases++;
    bad.forEach((f) => { this.fields[f] = (this.fields[f] || 0) + 1; });
    const cause = (causeFn && causeFn(input, theirs, ours, bad)) || 'غير مفسَّر';
    this.causes[cause] = (this.causes[cause] || 0) + 1;
    if (this.samples.filter((x) => x.cause === cause).length < 2 && this.samples.length < 24) this.samples.push({ input, bad: Object.fromEntries(bad.map((f) => [f, { theirs: theirs?.[f], ours: ours?.[f] }])), cause });
    return true;
  }
  missing(reason, n = 1, rows = []) { this.cases += n; this.diffCases += n; this.causes[reason] = (this.causes[reason] || 0) + n; rows.forEach((x) => { this.rowCases[x] = (this.rowCases[x] || 0) + n; this.rowDiffs[x] = (this.rowDiffs[x] || 0) + n; }); }
  get unexplained() { return this.causes['غير مفسَّر'] || 0; }
  toJSON() { const { id, title, rows, cases, diffCases, fields, causes, samples, notes, rowCases, rowDiffs } = this; return { id, title, rows, cases, diffCases, fields, causes, unexplained: this.unexplained, rowCases, rowDiffs, samples, notes }; }
}
