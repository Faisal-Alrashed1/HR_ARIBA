// مرفقات طلبات الإجازة التي يسجّلها HR من "طلب جديد": تُحفظ في IndexedDB على هذا الجهاز (نفس سلوك النسخة السابقة)
// وبالإضافة لذلك تُرفع لسجل وثائق الموظف في السحابة إن أمكن.
const DB = 'ARIBA_HR_LOCAL_ATTACHMENTS_V1';
const open = () => new Promise((res, rej) => { const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore('files', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
export async function saveLocalAtt(id, att) {
  if (!att) return; const db = await open();
  await new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put({ id: String(id), name: att.name, mime: att.mime, size: att.size, data: att.data, at: new Date().toISOString() }); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
export async function listLocalAtts() {
  try { const db = await open(); return await new Promise((res, rej) => { const r = db.transaction('files').objectStore('files').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); } catch { return []; }
}
export async function getLocalAtt(id) {
  const db = await open(); return new Promise((res, rej) => { const r = db.transaction('files').objectStore('files').get(String(id)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function deleteLocalAtt(id) {
  try { const db = await open(); await new Promise((res) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').delete(String(id)); t.oncomplete = res; t.onerror = res; }); } catch { /* ignore */ }
}
