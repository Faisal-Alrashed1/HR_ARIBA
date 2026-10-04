"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingState, Notice } from "@/components/ui/states";
import { ApiError, type TerminationArticle } from "@/lib/api";
import { accountForEmployee, createAccount, issueTemporaryPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { getEmployee, getLookups, listEmployees, reactivateEmployee, terminateEmployee, updateEmployee } from "@/lib/employees";
import { formatDate, todayIso } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

const ARTICLES: TerminationArticle[] = [
  "art_84", "art_74", "art_74_death", "art_74_retirement", "art_85", "art_75", "art_77", "art_80", "art_53",
];

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, tEnum, lang } = useLocale();
  const { hasRole } = useAuth();
  const canEdit = hasRole("hr", "admin");

  const emp = useApi(() => getEmployee(id), `employee:${id}`);
  const lookups = useApi(getLookups, "lookups");
  const managers = useApi(
    () => (canEdit ? listEmployees({ tab: "all", page_size: 100, sort: "name_ar" }) : Promise.resolve(null)),
    `managers:${canEdit}`,
  );

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [termDate, setTermDate] = useState(todayIso());
  const [article, setArticle] = useState<TerminationArticle>("art_84");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  if (emp.loading && !emp.data) return <LoadingState />;
  if (emp.error) return <ErrorState message={emp.error.message} onRetry={emp.reload} />;
  if (!emp.data || lookups.loading) return <LoadingState />;
  if (!lookups.data) return <ErrorState message={lookups.error?.message} onRetry={lookups.reload} />;

  const e = emp.data;
  const name = (lang === "en" && e.name_en) || e.name_ar;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const terminate = () =>
    run(async () => {
      emp.setData(await terminateEmployee(e.id, { termination_date: termDate, article, reason: reason || null }));
      setTerminateOpen(false);
    });

  const reactivate = () => run(async () => emp.setData(await reactivateEmployee(e.id)));

  const login = () =>
    run(async () => {
      if (e.has_account) {
        const user = await accountForEmployee(e.id);
        setTempPassword((await issueTemporaryPassword(user.id)).temporary_password);
      } else {
        setTempPassword((await createAccount(e.id)).temporary_password);
        emp.reload();
      }
    });

  return (
    <div>
      <PageHeader
        title={name}
        subtitle={[e.emp_no, e.job_title, e.workplace && (lang === "en" ? e.workplace.name_en : e.workplace.name_ar)].filter(Boolean).join(" · ")}
        actions={
          <>
            {e.is_terminated ? <Badge tone="danger">{t("emp.status.terminated")}</Badge> : <Badge tone="success">{t("emp.status.active")}</Badge>}
            {e.has_account && <Badge tone="accent">{t("emp.hasAccount")}</Badge>}
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              {t("common.print")}
            </Button>
            {canEdit && !e.is_terminated && (
              <Button variant="secondary" size="sm" onClick={login} loading={busy}>
                {e.has_account ? t("emp.resetPassword") : t("emp.createAccount")}
              </Button>
            )}
            {canEdit &&
              (e.is_terminated ? (
                <Button variant="secondary" size="sm" onClick={reactivate} loading={busy}>
                  {t("emp.reactivate")}
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setTerminateOpen(true)}>
                  {t("emp.terminate")}
                </Button>
              ))}
          </>
        }
      />

      {actionError && (
        <div className="mb-4">
          <Notice tone="danger">{actionError}</Notice>
        </div>
      )}
      {e.is_terminated && (
        <div className="mb-4">
          <Notice tone="warning">
            {t("emp.terminatedOn", { date: formatDate(e.termination_date), article: tEnum("termination_article", e.termination_article) })}
            {e.termination_reason && ` — ${e.termination_reason}`}
          </Notice>
        </div>
      )}

      <EmployeeForm
        key={e.updated_at}
        employee={e}
        lookups={lookups.data}
        managers={managers.data?.items ?? []}
        canEdit={canEdit}
        onSubmit={async (input) => emp.setData(await updateEmployee(e.id, input))}
      />

      <Dialog
        open={terminateOpen}
        onClose={() => setTerminateOpen(false)}
        title={t("emp.terminate")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTerminateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={terminate} loading={busy}>
              {t("emp.terminate")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label={t("emp.terminationDate")} type="date" dir="ltr" value={termDate} onChange={(ev) => setTermDate(ev.target.value)} />
          <Select
            label={t("emp.terminationArticle")}
            value={article}
            onChange={(ev) => setArticle(ev.target.value as TerminationArticle)}
            options={ARTICLES.map((a) => ({ value: a, label: tEnum("termination_article", a) }))}
          />
          <Textarea label={t("emp.terminationReason")} value={reason} onChange={(ev) => setReason(ev.target.value)} />
        </div>
      </Dialog>

      <Dialog
        open={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        title={t("emp.tempPassword")}
        footer={<Button onClick={() => setTempPassword(null)}>{t("common.close")}</Button>}
      >
        <p className="mb-3 rounded-lg bg-surface-2 p-3 text-center font-mono text-lg ltr-nums select-all">{tempPassword}</p>
        <p className="text-sm text-muted">{t("emp.tempPasswordHint")}</p>
      </Dialog>
    </div>
  );
}
