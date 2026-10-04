"use client";

import { useMemo, useState } from "react";
import { Badge, expiryTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, ReadField, Select, Textarea, type Option } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { ApiError, type Employee, type EmployeeInput, type EmployeeListItem, type Lookups } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/ar";
import { useLocale } from "@/lib/i18n/locale";
import { employeeFormSchema, issuesToErrors, type EmployeeFormValues } from "@/lib/validation";

type FormTab = "basic" | "documents" | "contract" | "salary" | "dependents";
type Values = Required<{ [K in keyof EmployeeFormValues]: NonNullable<EmployeeFormValues[K]> }>;

const ENUMS = {
  gender: ["male", "female"],
  religion: ["muslim", "other"],
  marital_status: ["single", "married", "divorced", "widowed"],
  category: ["active", "tamheer", "training", "consultant", "hourly"],
  wps_type: ["wps", "trainee", "tamheer", "external", "consultant", "no_wps", "remote"],
  contract_nature: ["indefinite", "fixed"],
  currency: ["SAR", "USD", "EUR", "EGP"],
  gosi_system: ["matching", "non_matching", "non_saudi"],
  payment_method: ["mudad", "bank_transfer", "international_transfer", "cash"],
} as const;

// Which tab each field lives on, so a server error can switch to the right tab.
const FIELD_TAB: Record<string, FormTab> = {
  national_id: "documents", national_id_expiry: "documents", passport_no: "documents", passport_expiry: "documents",
  insurance_company: "documents", insurance_class: "documents", insurance_card_no: "documents", insurance_expiry: "documents",
  contract_nature: "contract", contract_duration_months: "contract", join_date: "contract", annual_leave_days: "contract",
  basic_salary: "salary", housing_allowance: "salary", transport_allowance: "salary", project_allowance: "salary",
  other_allowances: "salary", other_deductions: "salary", currency: "salary", exchange_rate: "salary",
  gosi_system: "salary", payment_method: "salary", bank_name: "salary", iban: "salary",
  exclude_from_payroll: "salary", exclude_from_eos: "salary",
};

const SALARY_FIELDS = [
  "basic_salary", "housing_allowance", "transport_allowance", "project_allowance", "other_allowances",
  "other_deductions", "currency", "exchange_rate", "gosi_system", "payment_method", "bank_name", "iban",
] as const;
const ID_FIELDS = ["national_id", "passport_no", "insurance_card_no", "iban"] as const;

function initialValues(e?: Employee): Values {
  const s = e?.salary;
  return {
    emp_no: e?.emp_no ?? "",
    name_ar: e?.name_ar ?? "",
    name_en: e?.name_en ?? "",
    birth_date: e?.birth_date ?? "",
    gender: e?.gender ?? "",
    religion: e?.religion ?? "",
    marital_status: e?.marital_status ?? "",
    mobile: e?.mobile ?? "",
    email: e?.email ?? "",
    national_address: e?.national_address ?? "",
    nationality_id: e?.nationality?.id ?? "",
    workplace_id: e?.workplace?.id ?? "",
    department_id: e?.department?.id ?? "",
    job_title: e?.job_title ?? "",
    manager_id: e?.manager?.id ?? "",
    sponsor: e?.sponsor ?? "",
    category: e?.category ?? "active",
    wps_type: e?.wps_type ?? "wps",
    bank_name: s?.bank_name ?? "",
    iban: s?.iban ?? "",
    national_id: e?.national_id ?? "",
    national_id_expiry: e?.national_id_expiry ?? "",
    passport_no: e?.passport_no ?? "",
    passport_expiry: e?.passport_expiry ?? "",
    insurance_company: e?.insurance_company ?? "",
    insurance_class: e?.insurance_class ?? "",
    insurance_card_no: e?.insurance_card_no ?? "",
    insurance_expiry: e?.insurance_expiry ?? "",
    contract_nature: e?.contract_nature ?? "indefinite",
    contract_duration_months: e?.contract_duration_months ? String(e.contract_duration_months) : "",
    join_date: e?.join_date ?? "",
    annual_leave_days: String(e?.annual_leave_days ?? 21),
    basic_salary: s?.basic_salary ?? "0",
    housing_allowance: s?.housing_allowance ?? "0",
    transport_allowance: s?.transport_allowance ?? "0",
    project_allowance: s?.project_allowance ?? "0",
    other_allowances: s?.other_allowances ?? "0",
    other_deductions: s?.other_deductions ?? "0",
    currency: s?.currency ?? "SAR",
    exchange_rate: s?.exchange_rate ?? "1",
    gosi_system: s?.gosi_system ?? "matching",
    payment_method: s?.payment_method ?? "mudad",
    exclude_from_payroll: e?.exclude_from_payroll ?? false,
    exclude_from_eos: e?.exclude_from_eos ?? false,
    notes: e?.notes ?? "",
  };
}

/** Form values -> API body. Empty strings become null; numbers are converted. */
function toInput(v: Values, keys: (keyof Values)[]): EmployeeInput {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const raw = v[k];
    if (typeof raw === "boolean") out[k] = raw;
    else if (k === "contract_duration_months") out[k] = raw === "" ? null : Number(raw);
    else if (k === "annual_leave_days") out[k] = Number(raw);
    else if (SALARY_FIELDS.includes(k as (typeof SALARY_FIELDS)[number]) && raw === "" && k !== "bank_name" && k !== "iban") out[k] = "0";
    else out[k] = raw === "" ? null : raw;
  }
  return out as EmployeeInput;
}

export interface EmployeeFormProps {
  employee?: Employee;
  lookups: Lookups;
  managers: EmployeeListItem[];
  canEdit: boolean;
  onSubmit: (input: EmployeeInput) => Promise<void>;
}

export function EmployeeForm({ employee, lookups, managers, canEdit, onSubmit }: EmployeeFormProps) {
  const { t, tEnum, lang } = useLocale();
  const isCreate = !employee;
  const initial = useMemo(() => initialValues(employee), [employee]);
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<FormTab>("basic");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const salaryVisible = isCreate || !!employee?.salary;
  const idsLocked = !!employee?.ids_masked;
  const readOnly = !canEdit;

  const name = (o: { name_ar: string; name_en: string | null }) => (lang === "en" && o.name_en) || o.name_ar;
  const lookupOptions = (list: { id: string; name_ar: string; name_en: string }[]): Option[] =>
    list.map((o) => ({ value: o.id, label: lang === "en" ? o.name_en : o.name_ar }));
  const enumOptions = (group: keyof typeof ENUMS): Option[] => ENUMS[group].map((v) => ({ value: v, label: tEnum(group, v) }));
  const managerOptions: Option[] = managers
    .filter((m) => m.id !== employee?.id && !m.is_terminated)
    .map((m) => ({ value: m.id, label: `${name(m)} (${m.emp_no})` }));

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
    if (errors[key])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
  }

  // Bind helpers keep the JSX below short.
  const text = (key: keyof Values, label: MessageKey, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Input
      label={t(label)}
      value={values[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      error={errors[key]}
      disabled={readOnly || extra.disabled}
      {...extra}
    />
  );
  const select = (key: keyof Values, label: MessageKey, options: Option[], placeholder?: string, required = false) => (
    <Select
      label={t(label)}
      value={values[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      options={options}
      placeholder={placeholder}
      error={errors[key]}
      disabled={readOnly}
      required={required}
    />
  );
  const money = (key: keyof Values, label: MessageKey) =>
    text(key, label, { inputMode: "decimal", dir: "ltr", disabled: !salaryVisible });
  const dateField = (key: keyof Values, label: MessageKey, days?: number | null) => (
    <div className="flex flex-col gap-1">
      {text(key, label, { type: "date", dir: "ltr" })}
      {days !== undefined && days !== null && (
        <span>
          <Badge tone={expiryTone(days)}>{days < 0 ? t("common.expired") : t("emp.f.daysLeft", { n: days })}</Badge>
        </span>
      )}
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setFormError(null);
    const parsed = employeeFormSchema.safeParse(values);
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error);
      setErrors(errs);
      setTab(FIELD_TAB[Object.keys(errs)[0]] ?? "basic");
      return;
    }
    let keys = Object.keys(values) as (keyof Values)[];
    if (!isCreate) keys = keys.filter((k) => values[k] !== initial[k]); // PATCH only what changed
    if (!salaryVisible) keys = keys.filter((k) => !SALARY_FIELDS.includes(k as (typeof SALARY_FIELDS)[number]));
    if (idsLocked) keys = keys.filter((k) => !ID_FIELDS.includes(k as (typeof ID_FIELDS)[number]));
    if (isCreate && values.gosi_system === "matching") {
      // Let the backend pick the GOSI default from the nationality unless HR chose explicitly.
      const saudi = lookups.nationalities.find((n) => n.id === values.nationality_id)?.is_saudi;
      if (!saudi) keys = keys.filter((k) => k !== "gosi_system");
    }
    if (keys.length === 0) return;
    setBusy(true);
    try {
      await onSubmit(toInput(values, keys));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setErrors(fe);
        if (Object.keys(fe).length) setTab(FIELD_TAB[Object.keys(fe)[0]] ?? "basic");
        setFormError(err.message);
      } else setFormError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { value: FormTab; label: string }[] = [
    { value: "basic", label: t("emp.form.basic") },
    { value: "documents", label: t("emp.form.documents") },
    { value: "contract", label: t("emp.form.contract") },
    { value: "salary", label: t("emp.form.salary") },
    { value: "dependents", label: t("emp.form.dependents") },
  ];
  const grid = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Tabs items={tabs} value={tab} onChange={setTab} label={t("emp.title")} />
      {formError && <Notice tone="danger">{formError}</Notice>}
      {saved && <Notice tone="success">{t("common.saved")}</Notice>}

      <Card>
        {tab === "basic" && (
          <div className={grid}>
            {text("emp_no", "emp.f.empNo", { dir: "ltr", disabled: !isCreate, required: true, hint: t("auth.usernameHint") })}
            {text("name_ar", "emp.f.nameAr", { required: true })}
            {text("name_en", "emp.f.nameEn", { dir: "ltr" })}
            {select("nationality_id", "emp.f.nationality", lookupOptions(lookups.nationalities), "—")}
            {select("workplace_id", "emp.f.workplace", lookupOptions(lookups.workplaces), "—", true)}
            {select("department_id", "emp.f.department", lookupOptions(lookups.departments), "—")}
            {text("job_title", "emp.f.jobTitle")}
            {select("manager_id", "emp.f.manager", managerOptions, "—")}
            {text("sponsor", "emp.f.sponsor")}
            {select("category", "emp.f.category", enumOptions("category"))}
            {select("wps_type", "emp.f.wpsType", enumOptions("wps_type"))}
            {dateField("birth_date", "emp.f.birthDate")}
            {select("gender", "emp.f.gender", enumOptions("gender"), "—")}
            {select("religion", "emp.f.religion", enumOptions("religion"), "—")}
            {select("marital_status", "emp.f.maritalStatus", enumOptions("marital_status"), "—")}
            {text("mobile", "emp.f.mobile", { dir: "ltr", inputMode: "tel" })}
            {text("email", "emp.f.email", { dir: "ltr", type: "email" })}
            {text("national_address", "emp.f.nationalAddress")}
            <Textarea
              className="sm:col-span-2 lg:col-span-3"
              label={t("emp.f.notes")}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={readOnly || idsLocked}
            />
          </div>
        )}

        {tab === "documents" && (
          <div className="flex flex-col gap-4">
            {idsLocked && <Notice>{t("emp.form.idsMasked")}</Notice>}
            <div className={grid}>
              {text("national_id", "emp.f.nationalId", { dir: "ltr", inputMode: "numeric", disabled: idsLocked })}
              {dateField("national_id_expiry", "emp.f.nationalIdExpiry", employee?.expiry_days.national_id)}
              <div />
              {text("passport_no", "emp.f.passportNo", { dir: "ltr", disabled: idsLocked })}
              {dateField("passport_expiry", "emp.f.passportExpiry", employee?.expiry_days.passport)}
              <div />
              {text("insurance_company", "emp.f.insuranceCompany")}
              {text("insurance_class", "emp.f.insuranceClass")}
              {text("insurance_card_no", "emp.f.insuranceCardNo", { dir: "ltr", disabled: idsLocked })}
              {dateField("insurance_expiry", "emp.f.insuranceExpiry", employee?.expiry_days.insurance)}
            </div>
          </div>
        )}

        {tab === "contract" && (
          <div className={grid}>
            {select("contract_nature", "emp.f.contractNature", enumOptions("contract_nature"))}
            {values.contract_nature === "fixed" && text("contract_duration_months", "emp.f.contractDuration", { inputMode: "numeric", dir: "ltr" })}
            {dateField("join_date", "emp.f.joinDate")}
            {values.contract_nature === "fixed" && (
              <div className="flex flex-col gap-1">
                <ReadField label={t("emp.f.contractEnd")} value={formatDate(employee?.contract_end_date)} ltr />
                <span className="text-xs text-muted">{t("emp.f.contractEndAuto")}</span>
                {employee?.expiry_days.contract != null && (
                  <span>
                    <Badge tone={expiryTone(employee.expiry_days.contract)}>
                      {employee.expiry_days.contract < 0 ? t("common.expired") : t("emp.f.daysLeft", { n: employee.expiry_days.contract })}
                    </Badge>
                  </span>
                )}
              </div>
            )}
            {text("annual_leave_days", "emp.f.annualLeaveDays", { inputMode: "numeric", dir: "ltr" })}
          </div>
        )}

        {tab === "salary" &&
          (salaryVisible ? (
            <div className="flex flex-col gap-4">
              <div className={grid}>
                {money("basic_salary", "emp.f.basicSalary")}
                {money("housing_allowance", "emp.f.housing")}
                {money("transport_allowance", "emp.f.transport")}
                {money("project_allowance", "emp.f.project")}
                {money("other_allowances", "emp.f.otherAllowances")}
                {money("other_deductions", "emp.f.otherDeductions")}
                {select("currency", "emp.f.currency", enumOptions("currency"))}
                {values.currency !== "SAR" && text("exchange_rate", "emp.f.exchangeRate", { inputMode: "decimal", dir: "ltr" })}
                {select("gosi_system", "emp.f.gosiSystem", enumOptions("gosi_system"))}
                {select("payment_method", "emp.f.paymentMethod", enumOptions("payment_method"))}
                {text("bank_name", "emp.f.bankName")}
                {text("iban", "emp.f.iban", { dir: "ltr", disabled: idsLocked })}
              </div>
              {employee?.salary && (
                <ReadField label={t("emp.f.totalSalary")} value={formatMoney(employee.salary.total_salary, lang, employee.salary.currency)} ltr />
              )}
              <div className="flex flex-wrap gap-6">
                <Checkbox
                  label={t("emp.f.excludePayroll")}
                  checked={values.exclude_from_payroll}
                  onChange={(e) => set("exclude_from_payroll", e.target.checked)}
                  disabled={readOnly}
                />
                <Checkbox
                  label={t("emp.f.excludeEos")}
                  checked={values.exclude_from_eos}
                  onChange={(e) => set("exclude_from_eos", e.target.checked)}
                  disabled={readOnly}
                />
              </div>
            </div>
          ) : (
            <Notice>{t("emp.form.salaryHidden")}</Notice>
          ))}

        {tab === "dependents" && <Notice>{t("emp.form.dependentsSoon")}</Notice>}
      </Card>

      {canEdit && (
        <div className="no-print flex justify-end">
          <Button type="submit" loading={busy}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </form>
  );
}
