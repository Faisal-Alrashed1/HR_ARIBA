"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/finance/TaxCalc.jsx
export default portPage(() => import("@/port/pages/finance/TaxCalc.jsx"));
