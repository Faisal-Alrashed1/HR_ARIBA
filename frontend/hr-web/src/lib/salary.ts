// Salary basis rows (GET /salary/basis) — raw salary fields per employee for finance/HR screens.
import { request } from "./api";

export interface SalaryBasisRow {
  id: string;
  emp_no: string;
  name_ar: string;
  workplace: string | null;
  department: string | null;
  job_title: string | null;
  nationality: string | null;
  is_saudi: boolean;
  birth_date: string | null;
  category: string;
  wps_type: string;
  gosi_system: string;
  join_date: string | null;
  contract_duration_months: number | null;
  contract_end_date: string | null;
  annual_leave_days: number;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  project_allowance: string;
  other_allowances: string;
  extra_allowance: string;
  other_deductions: string;
  currency: string;
  exchange_rate: string;
  payment_method: string;
  bank_name: string | null;
  iban: string | null;
  exclude_from_payroll: boolean;
  exclude_from_eos: boolean;
  is_terminated: boolean;
  termination_date: string | null;
  termination_article: string | null;
  termination_reason: string | null;
}

export const getSalaryBasis = () => request<SalaryBasisRow[]>("/salary/basis");

/** Legacy `fN`: 0 / empty shows "0", otherwise en-US with up to 2 decimals. */
export const fN = (n: number | string | null | undefined) =>
  n ? Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

/** Legacy `aEmps()`: current (not terminated) employees. */
export const current = (rows: SalaryBasisRow[]) => rows.filter((e) => !e.is_terminated);
