import { PortShell } from "@/port/next/Shell.jsx";

// Their HR program (ARIBA_HR_React, copied into src/port): their layout, store and permission guard around each page.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortShell>{children}</PortShell>;
}
