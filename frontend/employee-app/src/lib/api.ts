// Client for the backend's versioned JSON API (/api/v1). Same contract as frontend/hr-web/src/lib/api.ts.
// Tokens live in the device's secure store (Keychain / Keystore), never in plain storage.
import * as SecureStore from "expo-secure-store";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;

const ACCESS = "ariba.access_token";
const REFRESH = "ariba.refresh_token";

export type Role = "employee" | "manager" | "finance" | "hr" | "ceo" | "admin";

export type EmployeeBrief = { id: string; emp_no: string; name_ar: string; name_en: string | null };

export type User = {
  id: string;
  username: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  employee: EmployeeBrief | null;
};

export type Session = { access_token: string; refresh_token: string; expires_in: number; user: User };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function saveSession(s: Session) {
  await SecureStore.setItemAsync(ACCESS, s.access_token);
  await SecureStore.setItemAsync(REFRESH, s.refresh_token);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}

export async function hasSession() {
  return (await SecureStore.getItemAsync(ACCESS)) !== null;
}

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": "ar" };
  if (init.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
}

async function refreshTokens(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(REFRESH);
  if (!refresh) return null;
  const res = await send("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) }, null);
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const s = (await res.json()) as Session;
  await saveSession(s);
  return s.access_token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = await SecureStore.getItemAsync(ACCESS);
  let res = await send(path, init, token);
  if (res.status === 401 && token) {
    token = await refreshTokens();
    if (token) res = await send(path, init, token);
  }
  if (!res.ok) {
    let code = "error";
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      // body was not JSON
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const auth = {
  login: (username: string, password: string) =>
    api<Session>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  changePassword: (old_password: string, new_password: string) =>
    api<Session>("/auth/change-password", { method: "POST", body: JSON.stringify({ old_password, new_password }) }),
  logout: async () => {
    try {
      await api<void>("/auth/logout", { method: "POST" });
    } finally {
      await clearSession();
    }
  },
  me: () => api<{ user: User }>("/me"),
};

export type Money = string; // the API serializes money as strings with 2 decimals

export type Salary = {
  basic_salary: Money;
  housing_allowance: Money;
  transport_allowance: Money;
  project_allowance: Money;
  other_allowances: Money;
  extra_allowance: Money;
  other_deductions: Money;
  total_salary: Money;
  gosi_employee: Money;
  gosi_employer: Money;
  net_salary: Money;
  net_salary_sar: Money;
  eos_award: Money | null;
  currency: string;
  exchange_rate: string;
  bank_name: string | null;
};

export type Lookup = { id: string; code: string; name_ar: string; name_en: string };

export type Employee = {
  id: string;
  emp_no: string;
  name_ar: string;
  name_en: string | null;
  mobile: string | null;
  email: string | null;
  nationality: { name_ar: string } | null;
  workplace: Lookup | null;
  department: Lookup | null;
  job_title: string | null;
  manager: EmployeeBrief | null;
  national_id: string | null;
  national_id_expiry: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  join_date: string | null;
  contract_end_date: string | null;
  annual_leave_days: number;
  years_of_service: string;
  salary: Salary | null;
};

export const me = {
  employee: () => api<Employee>("/me/employee"),
};
