"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/attendance/index.jsx
export default portPage(() => import("@/port/pages/attendance/index.jsx"));
