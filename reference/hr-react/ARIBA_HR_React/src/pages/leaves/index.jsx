import { useState } from 'react';
import { useLang } from '../../lib/i18n.js';
import { usePerm } from '../../store/AppStore.jsx';
import Pending from './Pending.jsx';
import AllRequests from './AllRequests.jsx';
import NewRequest from './NewRequest.jsx';
import Balances from './Balances.jsx';
import Holidays from './Holidays.jsx';
import Overtime from './Overtime.jsx';

export default function Leaves() {
  const h = useLang() === 'en';
  const perm = usePerm();
  const [tab, setTab] = useState('pend'); const [cnt, setCnt] = useState(0);
  const tabs = [['pend', 'معلقة', 'Pending'], ['all', 'كل الطلبات', 'All Requests'], ['new', 'طلب جديد', 'New Request'], ['bal', 'الأرصدة', 'Balances'], ['hol', 'الإجازات الرسمية', 'Official Holidays'], ['ot', '⏱️ عمل إضافي', '⏱️ Overtime']]
    .filter(([k]) => k !== 'new' || perm.edit('leaves'));
  return (
    <div className="pg on">
      <div className="tbar">{tabs.map(([k, ar, en]) => <div key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{h ? en : ar}{k === 'pend' && <> <span className="b ba">{cnt}</span></>}</div>)}</div>
      {tab === 'pend' && <Pending onCount={setCnt} />}
      {tab === 'all' && <AllRequests />}
      {tab === 'new' && <NewRequest onDone={() => setTab('pend')} />}
      {tab === 'bal' && <Balances />}
      {tab === 'hol' && <Holidays />}
      {tab === 'ot' && <Overtime />}
    </div>
  );
}
