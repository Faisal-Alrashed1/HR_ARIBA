import { useEmp } from './EmpStore.jsx';
import { useLocation } from './punch.jsx';
import { Svg, T, isEN, hav } from './util.jsx';

/** جهة العمل ومواقع العمل مع حالة النطاق (v122) */
export default function WorkLocations() {
  const { me } = useEmp();
  const { pos } = useLocation(false);
  if (!me) return null;
  const locs = (me.locations || []).filter((l) => l.type !== 'remote');
  const en = isEN();
  const status = (l) => {
    if (Number(l.lat) === 0 && Number(l.lng) === 0) return { cls: 'bad', txt: T('إحداثيات غير مضبوطة', 'Coordinates not set') };
    if (!pos) return { cls: '', txt: T('نصف القطر ', 'Radius ') + (l.radius_m || 200) + T(' م', ' m') };
    const d = hav(pos.lat, pos.lng, Number(l.lat), Number(l.lng)), inside = d <= (Number(l.radius_m) || 200);
    return { cls: inside ? 'ok' : '', txt: inside ? T('داخل النطاق ✓', 'Inside ✓') : (Math.round(d) >= 1000 ? (d / 1000).toFixed(1) + T(' كم', ' km') : Math.round(d) + T(' م', ' m')) };
  };
  return (
    <div className="card" id="a22Loc">
      <div className="card-title">📍 {T('جهة العمل ومواقع العمل', 'Employer & work locations')}</div>
      <div className="a22-emp"><span>{T('جهة العمل', 'Employer')}:</span><b>{me.employer || '—'}</b></div>
      {locs.length ? locs.map((l) => { const s = status(l); return (
        <div className="a22-row" key={l.id || l.name}><div className="a22-ic"><Svg n="pin" /></div><div className="a22-nm">{en ? (l.name_en || l.name) : l.name}</div><span className="a22-tg">{l.type === 'hq' ? T('مقر رئيسي', 'Head office') : T('مشروع', 'Project')}</span><span className={'a22-st ' + s.cls}>{s.txt}</span></div>
      ); }) : <div className="a22-note">{T('لا يوجد موقع عمل', 'No work location')}</div>}
    </div>
  );
}
