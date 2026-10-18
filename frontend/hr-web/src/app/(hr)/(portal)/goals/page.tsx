"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/goals/index.jsx
export default portPage(() => import("@/port/pages/goals/index.jsx"));
