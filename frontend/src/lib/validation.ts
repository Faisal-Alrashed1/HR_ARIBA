// zod schemas mirroring the backend's Pydantic rules, for instant feedback in forms.
// The backend re-validates everything; its errors are shown when they come back.

import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(60),
  password: z.string().min(1).max(200),
});

const letters = /[A-Za-z؀-ۿ]/;
const digits = /\d/;

export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1),
    new_password: z
      .string()
      .min(8, "auth.passwordRules")
      .refine((v) => letters.test(v) && digits.test(v), "auth.passwordRules"),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "auth.mismatch" })
  .refine((v) => v.new_password !== v.old_password, { path: ["new_password"], message: "auth.passwordRules" });

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const money = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Invalid amount").or(z.literal(""));

export const employeeFormSchema = z
  .object({
    emp_no: z.string().trim().regex(/^[A-Za-z]{0,5}\d{1,10}$/, "Employee number must look like emp084"),
    name_ar: z.string().trim().min(2).max(200),
    name_en: optionalText(200),
    birth_date: optionalDate,
    gender: z.string().optional(),
    religion: z.string().optional(),
    marital_status: z.string().optional(),
    mobile: z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, "Invalid mobile number").optional().or(z.literal("")),
    email: z.string().trim().email().optional().or(z.literal("")),
    national_address: optionalText(500),
    nationality_id: z.string().optional(),
    workplace_id: z.string().min(1, "Required"),
    department_id: z.string().optional(),
    job_title: optionalText(200),
    manager_id: z.string().optional(),
    sponsor: optionalText(200),
    category: z.string(),
    wps_type: z.string(),
    bank_name: optionalText(120),
    iban: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, "").toUpperCase())
      .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v), "Invalid IBAN")
      .optional(),
    national_id: z.string().trim().regex(/^\d{10}$/, "Must be 10 digits").optional().or(z.literal("")),
    national_id_expiry: optionalDate,
    passport_no: optionalText(30),
    passport_expiry: optionalDate,
    insurance_company: optionalText(120),
    insurance_class: optionalText(30),
    insurance_card_no: optionalText(60),
    insurance_expiry: optionalDate,
    contract_nature: z.enum(["fixed", "indefinite"]),
    contract_duration_months: z.string().regex(/^\d{0,3}$/).optional(),
    join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Required"),
    annual_leave_days: z.string().regex(/^\d{1,2}$/),
    basic_salary: money,
    housing_allowance: money,
    transport_allowance: money,
    project_allowance: money,
    other_allowances: money,
    other_deductions: money,
    currency: z.string(),
    exchange_rate: z.string().regex(/^\d{1,6}(\.\d{1,4})?$/, "Invalid rate"),
    gosi_system: z.string(),
    payment_method: z.string(),
    exclude_from_payroll: z.boolean(),
    exclude_from_eos: z.boolean(),
    notes: optionalText(4000),
  })
  .refine((v) => v.contract_nature !== "fixed" || Number(v.contract_duration_months) > 0, {
    path: ["contract_duration_months"],
    message: "Required for fixed-term contracts",
  });

export type EmployeeFormValues = z.input<typeof employeeFormSchema>;

/** zod issues -> { field: message } */
export function issuesToErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
