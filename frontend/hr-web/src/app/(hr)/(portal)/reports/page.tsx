"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/reports/index.jsx
export default portPage(() => import("@/port/pages/reports/index.jsx"));
