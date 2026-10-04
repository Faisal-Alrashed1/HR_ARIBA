"use client";

import { usePathname } from "next/navigation";
import { HrShell } from "./hr-shell";
import { MeShell } from "./me-shell";

/** Picks the chrome for the current route: none for /login, the employee app for /me, the HR portal otherwise. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  if (pathname === "/me" || pathname.startsWith("/me/")) return <MeShell>{children}</MeShell>;
  return <HrShell>{children}</HrShell>;
}
