"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { useAuth } from "@/lib/auth-context";
import type { MessageKey } from "@/lib/i18n/ar";
import { useLocale } from "@/lib/i18n/locale";
import { PrefsToggles } from "./prefs-toggles";

const TABS: { href: string; label: MessageKey; icon: keyof typeof Icons }[] = [
  { href: "/me", label: "me.home", icon: "home" },
  { href: "/me/attendance", label: "me.attendance", icon: "clock" },
  { href: "/me/leaves", label: "me.leaves", icon: "calendar" },
  { href: "/me/salary", label: "me.salary", icon: "money" },
  { href: "/me/team", label: "me.team", icon: "users" },
  { href: "/me/profile", label: "me.profile", icon: "user" },
];

/** Mobile-first employee app: header + bottom navigation. */
export function MeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { user, signOut, hasRole } = useAuth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-bg">
      <header className="no-print sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-dark text-sm font-bold text-white">A</span>
        <span className="flex-1 font-bold">{t("nav.employeeApp")}</span>
        <PrefsToggles />
        {user && hasRole("hr", "ceo", "admin", "finance") && (
          <Link href="/" className="rounded-lg px-2 py-1 text-xs hover:bg-surface-2">
            {t("nav.hrPortal")}
          </Link>
        )}
        <Link href="/me/settings" className="rounded-lg p-1.5 hover:bg-surface-2" aria-label={t("me.settings")}>
          <Icons.settings />
        </Link>
        {user && (
          <button type="button" onClick={signOut} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label={t("auth.signOut")}>
            <Icons.logout className="size-5 rtl:-scale-x-100" />
          </button>
        )}
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      <nav
        aria-label={t("nav.employeeApp")}
        className="no-print fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-2xl grid-cols-6 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map((tab) => {
          const Icon = Icons[tab.icon];
          const active = tab.href === "/me" ? pathname === "/me" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "font-semibold text-accent" : "text-muted"}`}
            >
              <Icon className="size-5" />
              {t(tab.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
