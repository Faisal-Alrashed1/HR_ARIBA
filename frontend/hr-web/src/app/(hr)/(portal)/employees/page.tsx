"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/employees/index.jsx
export default portPage(() => import("@/port/pages/employees/index.jsx"));
