"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import type { MessageKey } from "@/lib/i18n/ar";
import { useLocale } from "@/lib/i18n/locale";
import { canAccess } from "@/lib/routes";
import { PrefsToggles } from "./prefs-toggles";

interface NavItem {
  href: string;
  label: MessageKey;
  icon: keyof typeof Icons;
}

const SECTIONS: { title: MessageKey; items: NavItem[] }[] = [
  { title: "nav.general", items: [{ href: "/dashboard", label: "nav.dashboard", icon: "dashboard" }] },
  {
    title: "nav.people",
    items: [
      { href: "/employees", label: "nav.employees", icon: "users" },
      { href: "/attendance", label: "nav.attendance", icon: "clock" },
      { href: "/locations", label: "nav.locations", icon: "pin" },
      { href: "/leaves", label: "nav.leaves", icon: "calendar" },
      { href: "/documents", label: "nav.documents", icon: "file" },
    ],
  },
  {
    title: "nav.finance",
    items: [
      { href: "/payroll", label: "nav.payroll", icon: "money" },
      { href: "/payslips", label: "nav.payslips", icon: "file" },
      { href: "/end-of-service", label: "nav.endOfService", icon: "money" },
      { href: "/settlement", label: "nav.settlement", icon: "money" },
    ],
  },
  {
    title: "nav.admin",
    items: [
      { href: "/reports", label: "nav.reports", icon: "chart" },
      { href: "/templates", label: "nav.templates", icon: "file" },
      { href: "/settings", label: "nav.settings", icon: "settings" },
    ],
  },
];

export function HrShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t, tEnum, lang } = useLocale();
  const [open, setOpen] = useState(false);

  const visible = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !user || canAccess(i.href, user.role)) })).filter(
    (s) => s.items.length > 0,
  );
  const name = user?.employee ? (lang === "en" && user.employee.name_en) || user.employee.name_ar : user?.username;

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`no-print fixed inset-y-0 start-0 z-30 w-64 shrink-0 border-e border-border bg-surface transition-transform lg:static ${
          open ? "" : "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-dark text-sm font-bold text-white">A</span>
          <span className="font-bold">{t("app.name")}</span>
        </div>
        <nav className="flex flex-col gap-4 overflow-y-auto p-3" aria-label={t("nav.hrPortal")}>
          {visible.map((section) => (
            <div key={section.title}>
              <p className="px-2 pb-1 text-xs font-semibold text-muted">{t(section.title)}</p>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = Icons[item.icon];
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                          active ? "bg-accent-soft font-semibold text-accent" : "text-text hover:bg-surface-2"
                        }`}
                      >
                        <Icon className="size-4" />
                        {t(item.label)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div>
            <p className="px-2 pb-1 text-xs font-semibold text-muted">{t("nav.myAccount")}</p>
            <Link href="/me" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2">
              <Icons.user className="size-4" />
              {t("nav.employeeApp")}
            </Link>
          </div>
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur">
          <button type="button" className="rounded-lg p-1.5 hover:bg-surface-2 lg:hidden" onClick={() => setOpen(true)} aria-label="menu">
            <Icons.menu />
          </button>
          <div className="flex-1" />
          <PrefsToggles />
          {user && (
            <div className="flex items-center gap-2 border-s border-border ps-3">
              <div className="hidden text-end sm:block">
                <p className="text-sm font-medium leading-tight">{name}</p>
                <p className="text-xs text-muted">{tEnum("role", user.role)}</p>
              </div>
              <button type="button" onClick={signOut} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label={t("auth.signOut")} title={t("auth.signOut")}>
                <Icons.logout className="size-5 rtl:-scale-x-100" />
              </button>
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
