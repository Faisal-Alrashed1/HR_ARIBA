import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { AppShell } from "@/components/nav/app-shell";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, type Lang } from "@/lib/i18n/locale";
import { LANG_COOKIE, THEME_COOKIE } from "@/lib/prefs";
import { ThemeProvider, type Theme } from "@/lib/theme";
import "./globals.css";

// 'ARIBA Two' (the brand font) is not bundled yet; IBM Plex Sans Arabic is the stand-in.
const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "أريبا للموارد البشرية | Ariba HR", template: "%s | Ariba HR" },
  description: "Ariba for Consulting — HR portal and employee app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#014d3d",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const lang: Lang = jar.get(LANG_COOKIE)?.value === "en" ? "en" : "ar";
  const theme: Theme = jar.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme} className={font.variable}>
      <body className="min-h-dvh">
        <LocaleProvider lang={lang}>
          <ThemeProvider initial={theme}>
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
