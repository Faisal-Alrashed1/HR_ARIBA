import {
  request,
  type Employee,
  type EmployeeCounts,
  type EmployeeInput,
  type EmployeeListItem,
  type EmployeeTab,
  type Lookups,
  type Page,
  type TerminateInput,
  type Uuid,
} from "./api";

export interface EmployeeQuery {
  tab?: EmployeeTab;
  q?: string;
  workplace_id?: Uuid;
  department_id?: Uuid;
  page?: number;
  page_size?: number;
  sort?: string;
}

export const listEmployees = (query: EmployeeQuery = {}) =>
  request<Page<EmployeeListItem>>("/employees", { query: { ...query } });

export const employeeCounts = () => request<EmployeeCounts>("/employees/counts");

export const getEmployee = (id: Uuid) => request<Employee>(`/employees/${id}`);

export const createEmployee = (body: EmployeeInput) => request<Employee>("/employees", { method: "POST", body });

export const updateEmployee = (id: Uuid, body: EmployeeInput) =>
  request<Employee>(`/employees/${id}`, { method: "PATCH", body });

export const terminateEmployee = (id: Uuid, body: TerminateInput) =>
  request<Employee>(`/employees/${id}/terminate`, { method: "POST", body });

export const reactivateEmployee = (id: Uuid) => request<Employee>(`/employees/${id}/reactivate`, { method: "POST" });

export const myEmployee = () => request<Employee>("/me/employee");

export const getLookups = () => request<Lookups>("/settings/lookups");
