import { useMemo, useState } from 'react';
import { useApp, usePerm } from '../../store/AppStore.jsx';
import { useLang } from '../../lib/i18n.js';
import { rpc } from '../../lib/api.js';
import { fetchLocations } from '../../lib/data.js';
import { toast } from '../../components/Toast.jsx';
import Modal from '../../components/Modal.jsx';
import PromptModal from '../../components/PromptModal.jsx';
import { uid } from '../../lib/util.js';

const CLR = ['#29B35E', '#E4E4BC', '#6B7280', '#014D3D', '#14b8a6', '#a855f7'];
const gmUrl = (lat, lng) => 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng);
const empty = { id: '', name: '', employer: 'all', type: 'hq', radius: 200, lat: '', lng: '' };

export default function Locations() {
  const en = useLang() === 'en'; const T = (a, b) => (en ? b : a);
  const { locations, employees, setLocations } = useApp(); const can = usePerm().edit('locations');
  const [f, setF] = useState(null), [del, setDel] = useState(null);
  const employers = useMemo(() => [...new Set(employees.map((e) => e.employer).filter(Boolean))], [employees]);
  const typeLabel = { hq: T('مقر رئيسي', 'HQ'), project: T('مشروع', 'Project'), remote: T('عن بعد', 'Remote') };
  const summary = useMemo(() => {
    const by = {}, none = [];
    employees.filter((e) => !e.isTerminated && !e.term).forEach((e) => { const ids = Array.isArray(e.workLocationIds) ? e.workLocationIds : []; if (!ids.length) none.push(e); ids.forEach((i) => { (by[i] = by[i] || []).push(e); }); });
    const phys = locations.filter((l) => l && l.active !== false && l.type !== 'remote').sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
    return { by, none, phys };
  }, [employees, locations]);
  const nm = (e) => String((en ? (e.nameEn || e.nameAr) : (e.nameAr || e.nameEn)) || '').split(' ').slice(0, 3).join(' ');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function reload() { try { const l = await fetchLocations(); setLocations(l); } catch { /* ignore */ } }
  async function save() {
    const name = f.name.trim(), lat = parseFloat(f.lat), lng = parseFloat(f.lng), radius = Math.max(50, Math.min(5000, parseInt(f.radius, 10) || 200));
    if (!name) return toast(T('أدخل اسم الموقع', 'Enter location name'), 'ter');
    if (f.type !== 'remote' && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)) return toast(T('حدد إحداثيات صحيحة أو استخدم GPS', 'Enter valid coordinates or use GPS'), 'ter');
    const payload = { id: f.id || ('L' + Date.now()), name, name_en: name, employer: f.employer || 'all', type: f.type, latitude: Number.isFinite(lat) ? lat : 0, longitude: Number.isFinite(lng) ? lng : 0, radius_m: radius, active: true };
    try { await rpc('ariba_upsert_location', { p_location: payload }); setF(null); toast('✓ ' + T('تم حفظ الموقع', 'Location saved')); reload(); }
    catch (e) { toast(T('تعذر حفظ الموقع: ', 'Could not save the location: ') + (e.message || e), 'ter'); }
  }
  function gps() {
    if (!navigator.geolocation) return toast(T('GPS غير متاح', 'GPS not available'), 'ter');
    navigator.geolocation.getCurrentPosition((p) => { setF((s) => ({ ...s, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); toast('✓ ' + T('تم تحديد موقعك', 'Location captured')); }, () => toast(T('تعذر تحديد موقعك. اسمح للمتصفح باستخدام الموقع.', 'GPS error'), 'ter'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  const la = parseFloat(f && f.lat), ln = parseFloat(f && f.lng), okC = Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
  return (
    <div className="pg on" id="pg-loc" style={{ padding: '12px 16px' }}>
      <div className="ch"><div className="ct"><i className="ti ti-map-pin" /> <span>{T('مواقع البصمة الجغرافية', 'GPS locations')}</span></div>{can && <button className="btn bpl bsm" id="LOC_ADD" onClick={() => setF({ ...empty })}><i className="ti ti-plus" /> <span>{T('إضافة موقع', 'Add location')}</span></button>}</div>
      <div className="al alb" style={{ marginBottom: 12 }}><i className="ti ti-info-circle" /><span>{T('تُستخدم هذه المواقع في تطبيق الموظف للبصمة الجغرافية', 'These locations are used by the employee app for GPS punching')}</span></div>
      <div id="LCG" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {locations.filter((l) => l.active !== false).map((l, i) => { const color = l.color || CLR[i % CLR.length]; const lat = Number(l.lat ?? l.latitude), lng = Number(l.lng ?? l.longitude), radius = l.radius ?? l.radius_m; return (
          <div key={l.id} style={{ background: 'var(--c2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 14, borderTop: '3px solid ' + color }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={'ti ' + (l.type === 'remote' ? 'ti-home-laptop' : l.type === 'hq' ? 'ti-building' : 'ti-crane')} style={{ color, fontSize: 18 }} /></div>
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{en && l.nameEn ? l.nameEn : l.name}</div><div style={{ fontSize: 11, color: 'var(--dm)' }}>{typeLabel[l.type] || l.type} — {l.employer === 'all' ? T('الكل', 'All') : l.employer}</div></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 8 }}>{l.type === 'remote' ? T('بدون قيد موقع', 'No location restriction') : `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)} | ${T('النطاق', 'Radius')}: ${radius}m`}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {l.type !== 'remote' && <a className="btn bsm" target="_blank" rel="noopener noreferrer" href={gmUrl(lat, lng)} style={{ flex: 1, textDecoration: 'none' }}><i className="ti ti-brand-google-maps" /> Google Maps</a>}
              {can && <><button className="btn bsm" onClick={() => setF({ id: l.id, name: l.name, employer: l.employer || 'all', type: l.type || 'hq', radius: radius || 200, lat: lat || '', lng: lng || '' })}><i className="ti ti-edit" /> {T('تعديل', 'Edit')}</button><button className="btn bsm" style={{ color: 'var(--rd)' }} onClick={() => setDel(l)}><i className="ti ti-trash" /></button></>}
            </div>
          </div>); })}
        {!locations.length && <div style={{ color: 'var(--mu)', padding: 20 }}>{T('لا توجد مواقع', 'No locations')}</div>}
      </div>
      <div className="card" id="WL_SUM" style={{ marginTop: 12 }}>
        <div className="ct" style={{ padding: '0 0 8px' }}><i className="ti ti-users" /> {T('الموظفين المربوطين بمواقع البصمة', 'Employees linked to punch locations')}</div>
        <div className="tw"><table><thead><tr><th>{T('الموقع', 'Location')}</th><th>{T('النوع', 'Type')}</th><th>{T('عدد الموظفين', 'Employees')}</th><th>{T('الأسماء', 'Names')}</th></tr></thead><tbody>
          {summary.phys.map((l) => { const a = summary.by[l.id] || []; return <tr key={l.id}><td style={{ fontWeight: 700 }}>{en && l.nameEn ? l.nameEn : l.name}</td><td>{l.type === 'hq' ? T('مقر رئيسي', 'HQ') : T('مشروع', 'Project')}</td><td style={{ textAlign: 'center' }}>{a.length}</td><td style={{ fontSize: 11, color: 'var(--mu)' }}>{a.length ? a.map(nm).join('، ') : '—'}</td></tr>; })}
        </tbody></table></div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>{T('غير محدد لهم موقع (' + summary.none.length + ' موظف): بيبصموا في مواقع جهة عملهم.', 'No location assigned (' + summary.none.length + ' employees): they punch at their employer\'s locations.')}</div>
      </div>
      {f && <Modal open onClose={() => setF(null)} title={f.id ? T('تعديل الموقع', 'Edit location') : T('إضافة موقع بصمة', 'Add GPS location')} width={760}
        footer={<div className="mf"><button className="btn" onClick={() => setF(null)}>{T('إلغاء', 'Cancel')}</button><button className="btn bpl" id="LOC_SAVE" onClick={save}>{T('حفظ', 'Save')}</button></div>}>
        <div className="fg">
          <div><label>{T('اسم الموقع *', 'Location name *')}</label><input id="LN" value={f.name} onChange={set('name')} /></div>
          <div><label>{T('جهة العمل', 'Employer')}</label><select value={f.employer} onChange={set('employer')}><option value="all">{T('الكل', 'All')}</option>{employers.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>{T('النوع', 'Type')}</label><select value={f.type} onChange={set('type')}><option value="hq">{T('مقر رئيسي', 'HQ')}</option><option value="project">{T('مشروع خارجي', 'External project')}</option><option value="remote">{T('عمل عن بعد', 'Remote work')}</option></select></div>
          <div><label>{T('النطاق (متر)', 'Radius (m)')}</label><input type="number" min="50" max="5000" value={f.radius} onChange={set('radius')} /></div>
          <div><label>Latitude</label><input id="LLAT" type="number" step="0.000001" placeholder="24.7136" value={f.lat} onChange={set('lat')} /></div>
          <div><label>Longitude</label><input id="LLNG" type="number" step="0.000001" placeholder="46.6753" value={f.lng} onChange={set('lng')} /></div>
          <div className="ff"><button type="button" className="btn bsm" onClick={gps}><i className="ti ti-current-location" /> {T('موقعي الحالي (GPS)', 'My current location (GPS)')}</button> {okC && <a className="btn bsm" target="_blank" rel="noopener noreferrer" href={gmUrl(la, ln)} style={{ textDecoration: 'none' }}><i className="ti ti-brand-google-maps" /> {T('فتح في Google Maps', 'Open in Google Maps')}</a>}</div>
        </div>
        <div style={{ marginTop: 12, border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', background: 'var(--c2)', minHeight: 260 }}>
          {okC ? <iframe title="map" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" loading="lazy" style={{ width: '100%', height: 260, border: 0 }} src={'https://maps.google.com/maps?q=' + encodeURIComponent(la + ',' + ln) + '&z=16&output=embed'} />
            : <div style={{ padding: '40px 15px', textAlign: 'center', color: 'var(--mu)' }}>{T('حدد الإحداثيات أو استخدم GPS لعرض الموقع على Google Maps', 'Enter coordinates or use GPS to preview on Google Maps')}</div>}
        </div>
        <div style={{ marginTop: 7, fontSize: 10, color: 'var(--dm)' }}>{T('الدائرة الجغرافية هي نطاق البصمة الذي سيُستخدم للتحقق من حضور الموظف.', 'The radius is the punch range used to verify the employee presence.')}</div>
      </Modal>}
      <PromptModal open={!!del} noInput danger confirmText={T('حذف', 'Delete')} title={T('حذف موقع', 'Delete location')} message={T('هل تريد حذف هذا الموقع؟', 'Delete this location?')} onClose={() => setDel(null)}
        onConfirm={async () => { const l = del; setDel(null); try { await rpc('ariba_delete_location', { p_id: String(l.id) }); toast(T('تم الحذف', 'Deleted')); reload(); } catch (e) { toast(String(e.message || e), 'ter'); } }} />
    </div>
  );
}
