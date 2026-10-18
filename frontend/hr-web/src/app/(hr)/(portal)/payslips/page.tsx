"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/finance/Slip.jsx
export default portPage(() => import("@/port/pages/finance/Slip.jsx"));
