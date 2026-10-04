"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-bold text-muted">404</p>
      <Link href="/" className="mt-4 inline-block text-accent underline">
        {t("nav.dashboard")}
      </Link>
    </div>
  );
}
