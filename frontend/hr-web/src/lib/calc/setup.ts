// The engines' runtime (rt) from the server settings — their lib/data.js `runtimePatchFromSettings`, fed by
// GET /settings/runtime instead of the browser reading the database. Pages that run lib/calc formulas call
// `useRuntime()` once; the server keeps the final figures (docs/17_PORT_PLAN.md decision 7).
"use client";

import { useEffect, useState } from "react";
import { request } from "../api";
import { setRuntime } from "./runtime";
import { normSchedule } from "./schedule";

export interface RuntimeSettings {
  insurance: { wageCap: number; ageThreshold: number; effectiveRules: Record<string, unknown>[] } | null;
  carry: { enabled?: boolean; days?: number } | null;
  accrual: { method?: string } | null;
  country: { mode?: string; rules?: Record<string, unknown> | null } | null;
  schedule: Record<string, unknown> | null;
}

export const getRuntimeSettings = () => request<RuntimeSettings>("/settings/runtime");

export function runtimePatchFromSettings(s: Partial<RuntimeSettings>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (s.carry && typeof s.carry === "object") patch.leaveCarry = { enabled: s.carry.enabled !== false, days: Number(s.carry.days) || 0 };
  if (s.accrual && typeof s.accrual === "object" && ["calendar", "workdays", "monthly"].includes(String(s.accrual.method)))
    patch.leaveAccrual = s.accrual.method;
  if (s.insurance && Array.isArray(s.insurance.effectiveRules)) patch.insRules = s.insurance;
  patch.schedule = normSchedule(s.schedule);
  if (s.country && typeof s.country === "object") {
    patch.country = s.country.mode === "EG" ? "EG" : "SA";
    patch.egRules = s.country.rules || null;
  }
  return patch;
}

export function applyRuntime(s: Partial<RuntimeSettings>): void {
  setRuntime(runtimePatchFromSettings(s));
}

/** Loads the runtime settings once per page; `ready` turns true after they are applied (or failed — defaults stay). */
export function useRuntime(): { ready: boolean; settings: RuntimeSettings | null } {
  const [state, setState] = useState<{ ready: boolean; settings: RuntimeSettings | null }>({ ready: false, settings: null });
  useEffect(() => {
    let off = false;
    getRuntimeSettings()
      .then((s) => {
        applyRuntime(s);
        if (!off) setState({ ready: true, settings: s });
      })
      .catch(() => !off && setState({ ready: true, settings: null }));
    return () => {
      off = true;
    };
  }, []);
  return state;
}
