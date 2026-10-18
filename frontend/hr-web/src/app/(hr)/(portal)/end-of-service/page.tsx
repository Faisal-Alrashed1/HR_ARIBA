"use client";

import { portPage } from "@/port/next/page.jsx";

// Their screen: ARIBA_HR_React/src/pages/finance/Eos.jsx
export default portPage(() => import("@/port/pages/finance/Eos.jsx"));
