// يستبدل أي إيموجي داخل نصوص الواجهة (JSX) بأيقونة رسمية (Tabler) بلون البرنامج المعتمد.
// يعمل على مستوى jsx-runtime فلا يحتاج تعديل كل ملف، ويغطي النصوص الديناميكية والتنبيهات أيضاً.
import * as R from '../../node_modules/react/jsx-runtime.js';

const G = (icon, keys) => keys.map((k) => [k, icon]);
const MAP = Object.fromEntries([
  ...G('check', ['✓', '✔', '✔️']), ...G('circle-check', ['✅']), ...G('x', ['❌', '✕', '✗', '✖', '✖️']), ...G('alert-triangle', ['⚠️', '⚠']),
  ...G('hourglass', ['⏳']), ...G('key', ['🔑']), ...G('paperclip', ['📎']), ...G('arrow-back-up', ['↩', '🔄']), ...G('calendar', ['📅', '🗓️', '🗓']),
  ...G('signature', ['✍️', '✍']), ...G('square', ['☐']), ...G('edit', ['📝']), ...G('lock', ['🔐', '🔒']), ...G('lock-open', ['🔓']),
  ...G('id-badge-2', ['🪪']), ...G('file-text', ['📄', '📘']), ...G('clipboard-list', ['📋']), ...G('receipt', ['🧾']), ...G('bell', ['🔔']),
  ...G('clock', ['⏱️', '⏱', '⏰', '🕘']), ...G('map-pin', ['📍', '📌']), ...G('door-exit', ['🚪']), ...G('man', ['👨', '👦', '👴']), ...G('woman', ['👩', '👧', '👵']),
  ...G('users-group', ['👨‍👩‍👧', '👥']), ...G('coin', ['💰']), ...G('target', ['🎯']), ...G('star', ['⭐']), ...G('user', ['👤']), ...G('download', ['⬇', '📥']),
  ...G('pencil', ['✏️', '✏']), ...G('upload', ['📤']), ...G('beach', ['🏖️', '🏖']), ...G('printer', ['🖨️', '🖨']), ...G('robot', ['🤖']), ...G('trash', ['🗑', '🗑️']),
  ...G('building-bank', ['🏦']), ...G('moon', ['🌙']), ...G('folder', ['📁']), ...G('circle-filled', ['🟢', '🔴']), ...G('circle', ['⚪']), ...G('help-circle', ['❓']),
  ...G('ban', ['🚫']), ...G('hand-stop', ['🖐']), ...G('heart-handshake', ['🤝']), ...G('school', ['🎓']), ...G('device-mobile', ['📱']), ...G('cake', ['🎂']),
  ...G('pill', ['💊']), ...G('building', ['🏢']), ...G('eye', ['👁']), ...G('stethoscope', ['🩺']),
]);
const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const GENERIC = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B50}\\u{2B05}-\\u{2B07}\\u{23E9}-\\u{23F3}][\\uFE0F\\u200D]*';
const RX = new RegExp('(' + keys.join('|') + '|' + GENERIC + ')', 'u');
const HAS = new RegExp(keys.join('|') + '|' + GENERIC, 'u');
const PLAIN = new Set(['option', 'textarea', 'title', 'script', 'style', 'input']);

function split(str) {
  const parts = str.split(RX); const out = [];
  parts.forEach((p, i) => {
    if (!p) return;
    if (i % 2 === 1) { const ic = MAP[p] || MAP[p.replace(/️/g, '')]; if (ic) out.push(R.jsx('i', { className: 'ti ti-' + ic + ' ti-emo', 'aria-hidden': 'true' }, 'e' + i)); }
    else out.push(p);
  });
  // مسافة زائدة بعد الأيقونة المحذوفة/المستبدلة تبقى كما هي
  return out;
}
const strip = (s) => s.split(RX).filter((_, i) => i % 2 === 0).join('').replace(/^\s+/, '');
function conv(ch, plain) {
  if (typeof ch === 'string') { if (!HAS.test(ch)) return ch; return plain ? strip(ch) : split(ch); }
  if (Array.isArray(ch)) { let ch2 = false; const o = ch.map((c) => { if (typeof c === 'string' && HAS.test(c)) { ch2 = true; return plain ? strip(c) : R.jsx(R.Fragment, { children: split(c) }, 'f' + Math.random().toString(36).slice(2, 7)); } return c; }); return ch2 ? o : ch; }
  return ch;
}
function fix(type, props) {
  if (!props || typeof type === 'symbol' && type !== R.Fragment) return props;
  const c = props.children; if (c == null || typeof c === 'object' && !Array.isArray(c)) return props;
  const n = conv(c, typeof type === 'string' && PLAIN.has(type)); return n === c ? props : { ...props, children: n };
}
export const Fragment = R.Fragment;
export const jsx = (t, p, k) => R.jsx(t, fix(t, p), k);
export const jsxs = (t, p, k) => R.jsxs(t, fix(t, p), k);
