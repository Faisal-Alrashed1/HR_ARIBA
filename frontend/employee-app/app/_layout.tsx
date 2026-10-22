import { useFonts } from "expo-font";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager, Platform } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider } from "@/lib/data";
import { NotificationsProvider } from "@/lib/notifications";
import { Loading, ToastProvider } from "@/components/ui";
import { fonts, ThemeProvider, useTheme } from "@/theme";

// Native builds force RTL (expo-localization forcesRTL). In Expo Go on a phone set to English the layout would run
// left-to-right, so ask for RTL here too (it takes effect the next time the app is opened). The web preview needs the document direction.
if (Platform.OS !== "web" && !I18nManager.isRTL) { I18nManager.allowRTL(true); I18nManager.forceRTL(true); }
if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.dir = "rtl";

function Gate() {
  const { user, ready } = useAuth();
  const t = useTheme();
  const segments = useSegments();
  if (!ready) return <Loading />;

  const screen = segments[0];
  if (!user && screen !== "login") return <Redirect href="/login" />;
  if (user?.must_change_password && screen !== "change-password") return <Redirect href="/change-password" />;
  if (user && !user.must_change_password && (screen === "login" || screen === "change-password"))
    return <Redirect href="/" />;

  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    [fonts.light]: require("../assets/fonts/ARIBA_TWO_LIGHT.ttf"),
    [fonts.medium]: require("../assets/fonts/ARIBA_TWO_MEDIUM.ttf"),
    [fonts.bold]: require("../assets/fonts/ARIBA_TWO_BOLD.ttf"),
  });
  if (!loaded) return null;
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <ToastProvider>
            <DataProvider>
              <Gate />
            </DataProvider>
          </ToastProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
