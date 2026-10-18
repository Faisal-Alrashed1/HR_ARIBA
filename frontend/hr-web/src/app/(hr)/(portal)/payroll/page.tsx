"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/payroll/index.jsx
export default portPage(() => import("@/port/pages/payroll/index.jsx"));
