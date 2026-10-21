import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "@/styles/employee.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/common/toast";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, type Lang } from "@/lib/i18n/locale";
import { EMP_THEME_COOKIE, LANG_COOKIE } from "@/lib/prefs";
import { RefreshProvider } from "@/lib/refresh";
import { ThemeProvider, type Theme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "تطبيق الموظف - اريبا",
  description: "Ariba for Consulting — employee app",
  icons: { icon: "/brand/ariba-logo.png" },
};

// Edge to edge (the CSS pads the bars with env(safe-area-inset-*)); the status-bar colour follows the app's own day / night.
export async function generateViewport(): Promise<Viewport> {
  const night = (await cookies()).get(EMP_THEME_COOKIE)?.value === "dark";
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: night ? "#013D31" : "#FFFDF8" };
}

// Employee app root layout. Like its prototype it opens in day mode and turns left-to-right in English.
export default async function EmployeeRootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const lang: Lang = jar.get(LANG_COOKIE)?.value === "en" ? "en" : "ar";
  const theme: Theme = jar.get(EMP_THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-ariba-theme={theme}>
      <body className={`ariba-${theme}`}>
        <LocaleProvider lang={lang} flipDir>
          <ThemeProvider initial={theme} cookie={EMP_THEME_COOKIE} bodyClass>
            <ToastProvider variant="emp">
              <AuthProvider>
                <RefreshProvider>{children}</RefreshProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
