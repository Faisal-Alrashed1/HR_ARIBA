// صور ورق أريبا الجاهز (اختياري): src/assets/letterhead/head.* و foot.* — تُضمَّن داخل البناء كـ data URL
const mods = import.meta.glob('../assets/letterhead/*.{png,jpg,jpeg,webp}', { eager: true, query: '?inline', import: 'default' });
const pick = (n) => { const k = Object.keys(mods).find((p) => new RegExp('/' + n + '\\.', 'i').test(p)); return k ? String(mods[k]) : ''; };
export const ARIBA_LH = { head: pick('head'), foot: pick('foot') };
export const hasAribaLH = !!(ARIBA_LH.head || ARIBA_LH.foot);
