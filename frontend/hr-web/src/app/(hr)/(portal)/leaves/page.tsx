"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/leaves/index.jsx
export default portPage(() => import("@/port/pages/leaves/index.jsx"));
