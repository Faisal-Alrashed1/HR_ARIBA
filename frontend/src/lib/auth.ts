import { request, type Session, type TemporaryPassword, type User, type Role, type Uuid } from "./api";
import { clearSession, saveSession, setMustChange } from "./session";

export async function login(username: string, password: string): Promise<User> {
  const s = await request<Session>("/auth/login", { method: "POST", body: { username, password }, anonymous: true });
  saveSession(s.access_token, s.refresh_token, s.expires_in, s.user.must_change_password);
  return s.user;
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}

export async function fetchMe(): Promise<User> {
  return (await request<{ user: User }>("/me")).user;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await request<void>("/auth/change-password", {
    method: "POST",
    body: { old_password: oldPassword, new_password: newPassword },
  });
  setMustChange(false);
}

export const createAccount = (employeeId: Uuid, role: Role = "employee") =>
  request<TemporaryPassword>("/auth/users", { method: "POST", body: { employee_id: employeeId, role } });

export const accountForEmployee = (employeeId: Uuid) => request<User>(`/auth/users/by-employee/${employeeId}`);

export const issueTemporaryPassword = (userId: Uuid) =>
  request<TemporaryPassword>(`/auth/users/${userId}/temporary-password`, { method: "POST" });

export { homeFor } from "./routes";
