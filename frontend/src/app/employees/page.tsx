"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Pagination, Table, type Column } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { EmployeeListItem, EmployeeTab } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { employeeCounts, getLookups, listEmployees } from "@/lib/employees";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale";
import { useApi } from "@/lib/use-api";

const TABS: EmployeeTab[] = ["all", "active", "terminated", "tamheer", "training", "consultants", "saudi", "expat"];
const PAGE_SIZE = 25;

export default function EmployeesPage() {
  const { t, lang } = useLocale();
  const { hasRole } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<EmployeeTab>("active");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = { tab, q, workplace_id: workplace || undefined, department_id: department || undefined, page, page_size: PAGE_SIZE };
  const list = useApi(() => listEmployees(query), JSON.stringify(query));
  const counts = useApi(employeeCounts, "counts");
  const lookups = useApi(getLookups, "lookups");

  const name = (r: { name_ar: string; name_en: string | null }) => (lang === "en" && r.name_en) || r.name_ar;
  const lookupName = (l: { name_ar: string; name_en: string } | null) => (l ? (lang === "en" ? l.name_en : l.name_ar) : "—");

  const columns: Column<EmployeeListItem>[] = [
    { key: "no", header: t("emp.col.empNo"), cell: (r) => <span className="ltr-nums font-medium">{r.emp_no}</span> },
    {
      key: "name",
      header: t("emp.col.name"),
      cell: (r) => (
        <Link href={`/employees/${r.id}`} className="font-medium text-text hover:text-accent" onClick={(e) => e.stopPropagation()}>
          {name(r)}
        </Link>
      ),
    },
    { key: "job", header: t("emp.col.job"), cell: (r) => r.job_title ?? "—" },
    { key: "wp", header: t("emp.col.workplace"), cell: (r) => lookupName(r.workplace) },
    { key: "dep", header: t("emp.col.department"), cell: (r) => lookupName(r.department) },
    { key: "nat", header: t("emp.col.nationality"), cell: (r) => lookupName(r.nationality) },
    { key: "id", header: t("emp.col.nationalId"), cell: (r) => <span className="ltr-nums">{r.national_id_masked ?? "—"}</span> },
    { key: "join", header: t("emp.col.joinDate"), cell: (r) => <span className="ltr-nums">{formatDate(r.join_date)}</span> },
    {
      key: "status",
      header: t("emp.col.status"),
      cell: (r) =>
        r.is_terminated ? <Badge tone="danger">{t("emp.status.terminated")}</Badge> : <Badge tone="success">{t("emp.status.active")}</Badge>,
    },
  ];

  const lookupOptions = (items: { id: string; name_ar: string; name_en: string }[] = []) =>
    items.map((o) => (
      <option key={o.id} value={o.id}>
        {lang === "en" ? o.name_en : o.name_ar}
      </option>
    ));

  return (
    <div>
      <PageHeader
        title={t("emp.title")}
        actions={
          hasRole("hr", "admin") && (
            <Link href="/employees/new">
              <Button>
                <Icons.plus className="size-4" />
                {t("emp.new")}
              </Button>
            </Link>
          )
        }
      />

      <Tabs
        label={t("emp.title")}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setPage(1);
        }}
        items={TABS.map((v) => ({ value: v, label: t(`emp.tab.${v}`), count: counts.data?.[v] }))}
      />

      <div className="no-print my-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("emp.searchPlaceholder")}
          aria-label={t("common.search")}
          className="h-10 min-w-60 flex-1 rounded-lg border border-border bg-surface px-3 text-sm"
        />
        <select
          aria-label={t("emp.filter.workplace")}
          value={workplace}
          onChange={(e) => {
            setWorkplace(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">{t("emp.filter.workplace")}: {t("common.all")}</option>
          {lookupOptions(lookups.data?.workplaces)}
        </select>
        <select
          aria-label={t("emp.filter.department")}
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">{t("emp.filter.department")}: {t("common.all")}</option>
          {lookupOptions(lookups.data?.departments)}
        </select>
      </div>

      {list.loading && !list.data ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState message={t("emp.empty")} />
      ) : (
        <>
          <Table
            caption={t("emp.title")}
            columns={columns}
            rows={list.data.items}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/employees/${r.id}`)}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPage={setPage}
            labels={{
              previous: t("common.previous"),
              next: t("common.next"),
              summary: `${t("common.results", { total: list.data.total })} · ${t("common.page", {
                page,
                pages: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)),
              })}`,
            }}
          />
        </>
      )}
    </div>
  );
}
