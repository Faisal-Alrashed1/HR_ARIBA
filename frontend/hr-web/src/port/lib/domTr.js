// عند اختيار الإنجليزي: أي نص عربي متبقّي في الشاشة (عناوين، أزرار، جداول، تلميحات) يتترجم تلقائياً بالقاموس،
// وعند الرجوع للعربي بيرجع النص الأصلي. بيشتغل في برنامج HR وتطبيق الموظف.
import { getLang } from './i18n.js';
import { loadTr } from './tr.js';

const AR = /[؀-ۿ]/;
const SKIP = 'script,style,textarea,input,[data-notr],[contenteditable="true"],.notr';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const textOrig = new WeakMap();           // نص → { src, out }
const attrOrig = new WeakMap();           // عنصر → { attr: { src, out } }
const tracked = new Set();                // عشان الاسترجاع
let tr = null, obs = null, queued = false, busy = false, pending = new Set();

function doText(n) {
  const p = n.parentElement; if (!p || p.closest(SKIP)) return;
  const v = n.nodeValue; if (!v || !AR.test(v)) return;
  const rec = textOrig.get(n); if (rec && rec.out === v) return;   // ده نصنا المترجم بالفعل
  const out = tr(v); if (out === v) return;
  textOrig.set(n, { src: v, out }); tracked.add(n); n.nodeValue = out;
}
function doAttrs(el) {
  if (!el.getAttribute || el.closest(SKIP) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a); if (!v || !AR.test(v)) continue;
    const m = attrOrig.get(el) || {}; if (m[a] && m[a].out === v) continue;
    const out = tr(v); if (out === v) continue;
    m[a] = { src: v, out }; attrOrig.set(el, m); tracked.add(el); el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  if (root.matches && root.matches('script,style')) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
}
function flush() {
  queued = false; if (!tr || getLang() !== 'en') return;
  busy = true; try { const list = [...pending]; pending = new Set(); list.forEach((n) => { if (n.isConnected) walk(n); }); } finally { busy = false; }
  if (obs) obs.takeRecords();
}
function schedule(n) { pending.add(n); if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(flush); } }
function start() {
  if (obs || !tr) return;
  obs = new MutationObserver((recs) => {
    if (busy) return;
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach((n) => schedule(n));
      else if (r.type === 'characterData') schedule(r.target);
      else if (r.type === 'attributes') schedule(r.target);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  schedule(document.body);
}
function stop() {
  if (obs) { obs.disconnect(); obs = null; }
  tracked.forEach((x) => {
    if (x.nodeType === 3) { const r = textOrig.get(x); if (r && x.nodeValue === r.out) x.nodeValue = r.src; textOrig.delete(x); }
    else { const m = attrOrig.get(x); if (m) { for (const a in m) if (x.getAttribute(a) === m[a].out) x.setAttribute(a, m[a].src); attrOrig.delete(x); } }
  });
  tracked.clear();
}
/** يُستدعى عند كل تغيير لغة (ومرة عند البدء) */
export async function syncDomTr() {
  if (getLang() === 'en') { if (!tr) tr = await loadTr(); if (getLang() === 'en') start(); }
  else stop();
}
