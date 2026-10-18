"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/audit/index.jsx
export default portPage(() => import("@/port/pages/audit/index.jsx"));
