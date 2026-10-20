// ADAPTED (not in their source): the ARIBA palette — two primary colours (dark #014D3D, light #28B35D) and two
// secondary (dark #231F20, light #E4E4BC), from the company identity file (ARIBA_LAYOUT). Their screens also set
// other colours inline (blue / purple / teal / orange / brown buttons and texts); ico-runtime.js passes every inline
// style through brandStyle(), which maps those to the nearest brand colour. Red stays for errors only; greys stay as
// neutrals. An element with data-keep-color (the colour pickers in Settings) keeps its real colours.
const DEEP = '#014D3D', BRIGHT = '#28B35D', CHAR = '#231F20', TINT = '#F4F0E4';
const MAP = {
  // blues, purples, teals, dark greens → primary dark
  '0a7a3f': DEEP, '15803d': DEEP, '166534': DEEP, '047857': DEEP, '065f46': DEEP, '059669': DEEP, '0f766e': DEEP,
  '0a5c9e': DEEP, '1e3a8a': DEEP, '1d4ed8': DEEP, '2563eb': DEEP, '581c87': DEEP, '7c3aed': DEEP, '6d28d9': DEEP,
  // bright greens, cyans, bright blues and purples → primary light
  '10b981': BRIGHT, '12b76a': BRIGHT, '16a34a': BRIGHT, '22c55e': BRIGHT, '14b8a6': BRIGHT, '06b6d4': BRIGHT,
  '0ea5e9': BRIGHT, '3b82f6': BRIGHT, '6366f1': BRIGHT, '8b5cf6': BRIGHT, 'a855f7': BRIGHT, '34d399': BRIGHT, '29b35e': BRIGHT,
  // browns (buttons with white text) → secondary dark
  '7a3e00': CHAR, '7c2d12': CHAR, '92400e': CHAR,
  // ambers / oranges (warnings) → secondary: charcoal in day mode, beige at night (--ar-warm)
  'f59e0b': 'var(--ar-warm)', 'd97706': 'var(--ar-warm)', 'b45309': 'var(--ar-warm)', '856a00': 'var(--ar-warm)',
  'ea580c': 'var(--ar-warm)', 'f97316': 'var(--ar-warm)', 'eab308': 'var(--ar-warm)',
  // light tints → the light background
  'eaf0fa': TINT, 'f3ebfa': TINT, 'e8f5f3': TINT, 'fdf2f8': TINT, 'fffbeb': TINT, 'fff7ed': TINT, 'fefce8': TINT, 'fbf0e6': TINT, 'eff6ff': TINT,
};
const WARM_ALPHA = 'E4E4BC'; // a translucent warning tint (#f59e0b14) becomes a translucent beige
const RX = /#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-fA-F])/g;

function mapColor(str) {
  if (typeof str !== 'string' || str.indexOf('#') < 0) return str;
  return str.replace(RX, (m, hex, alpha) => {
    const to = MAP[hex.toLowerCase()];
    if (!to) return m;
    if (alpha) return '#' + (to.startsWith('var(') ? WARM_ALPHA : to.slice(1)) + alpha;
    return to;
  });
}

/** Their inline style object with the brand colours; the same object when nothing changes. */
export function brandStyle(style) {
  if (!style || typeof style !== 'object') return style;
  let out = null;
  for (const k in style) {
    const v = style[k];
    if (typeof v !== 'string') continue;
    const n = mapColor(v);
    if (n !== v) { if (!out) out = { ...style }; out[k] = n; }
  }
  return out || style;
}
