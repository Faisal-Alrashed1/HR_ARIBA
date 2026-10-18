import { Route, Routes } from '../../router.jsx';
import EmpList from './EmpList.jsx';
import EmpForm from './EmpForm.jsx';
import { usePerm } from '../../store/AppStore.jsx';

function Gated({ children }) {
  const p = usePerm();
  if (!(p.edit('employees_admin') || p.edit('employees'))) return <div className="pg on" style={{ padding: 30, color: 'var(--am)' }}>صلاحيتك للعرض فقط</div>;
  return children;
}
export default function Employees() {
  return (
    <Routes>
      <Route index element={<EmpList />} />
      <Route path="new" element={<Gated><EmpForm key="new" /></Gated>} />
      <Route path=":id/edit" element={<Gated><EmpForm /></Gated>} />
    </Routes>
  );
}
