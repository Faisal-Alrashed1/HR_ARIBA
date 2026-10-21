// App shell of the legacy employee app (V118 js/core-ui/030 + 012/016/026/032): sticky header (page title, bell, key,
// logout, day/night, manual refresh) and the floating bottom nav. Approvals only for manager / hr / ceo / admin.
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { getRefreshToken } from "@/lib/api";
import { biometricAvailable, biometricEnabled, enableBiometric, remembered, setNudged, wasNudged } from "@/lib/biometric";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Tabs } from "expo-router";
import { Icon } from "@/components/icons";
import { PasswordSheet } from "@/components/password-sheet";
import { T, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { useBell } from "@/lib/notifications";
import { PunchProvider } from "@/lib/punch";
import { brand, useTheme, useThemeMode } from "@/theme";
import { rgba, shadow } from "@/lib/shadow";
import { haptic } from "@/lib/haptics";
import { useReducedMotion, useReducedTransparency } from "@/lib/motion";

const TABS: { name: string; title: string; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { name: "index", title: "الرئيسية", label: "الرئيسية", icon: "home" },
  { name: "attendance", title: "الحضور", label: "الحضور", icon: "clock" },
  { name: "leaves", title: "الإجازات", label: "الإجازات", icon: "calendar" },
  { name: "salary", title: "الراتب", label: "الراتب", icon: "cash" },
  { name: "team", title: "فريقي", label: "فريقي", icon: "users" },
  { name: "profile", title: "ملفي", label: "ملفي", icon: "user" },
  { name: "goals", title: "أهدافي وتقييمي", label: "أهدافي", icon: "star" },
  { name: "overtime", title: "عمل إضافي", label: "عمل إضافي", icon: "stopwatch" },
  { name: "documents", title: "المستندات", label: "مستندات", icon: "file" },
  { name: "approvals", title: "الموافقات", label: "الموافقات", icon: "checks" },
];
const PREF_LABEL = { system: "تلقائي", light: "نهاري", dark: "ليلي" } as const;
const APPROVERS = ["manager", "hr", "ceo", "admin", "admin_manager", "chairman"];

function IconBtn({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [styles.ib, { borderColor: t.bd, backgroundColor: t.c2, transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

function Header({ title }: { title: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { mode, pref, toggle } = useThemeMode();
  const reduced = useReducedMotion();
  const { signOut } = useAuth();
  const { refresh } = useData();
  const bell = useBell();
  const toast = useToast();
  const [pw, setPw] = useState(false);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const spin = useState(() => new Animated.Value(0))[0];

  async function manualRefresh() {
    if (busy) return;
    setBusy(true);
    spin.setValue(0);
    if (!reduced) Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })).start();
    try {
      await Promise.all([refresh(), bell.refresh()]);
      toast("تم التحديث والحفظ", "ok");
    } catch {
      toast("تعذر إكمال التحديث", "err");
    } finally {
      spin.stopAnimation();
      setBusy(false);
    }
  }

  return (
    <View style={[styles.hdr, { paddingTop: insets.top + 10, backgroundColor: t.c, borderBottomColor: "rgba(1,77,61,.10)" }]}>
      <T size={17} weight={800} style={{ letterSpacing: 0.2, flexShrink: 1 }} numberOfLines={1}>{title}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconBtn label={bell.unread > 0 ? `الإشعارات، ${bell.unread} جديد` : "الإشعارات"} onPress={() => { setPanel(true); bell.refresh(); }}>
          <Icon name="bell" size={19} color={t.tx} stroke={2} />
          {bell.unread > 0 ? (
            <View style={[styles.badge, { borderColor: t.c }]}><T size={12} weight={800} color="#fff">{bell.unread > 99 ? "99+" : bell.unread}</T></View>
          ) : null}
        </IconBtn>
        <IconBtn label="تغيير كلمة المرور" onPress={() => setPw(true)}><Icon name="key" size={18} color={t.tx} stroke={2} /></IconBtn>
        <IconBtn label="خروج" onPress={signOut}><Icon name="logout" size={18} color={t.tx} stroke={2} /></IconBtn>
        <Pressable onPress={() => { haptic.select(); toggle(); }} accessibilityRole="button" accessibilityLabel={`المظهر: ${PREF_LABEL[pref]}. اضغط للتغيير`} hitSlop={4} style={[styles.mode, { backgroundColor: brand.beige, borderColor: brand.beige }]}>
          <T size={12} weight={800} color={t.dark ? "#FFFFFF" : "#014D3D"}>{PREF_LABEL[pref]}</T>
        </Pressable>
        <Pressable onPress={manualRefresh} accessibilityRole="button" accessibilityLabel="تحديث" accessibilityState={{ busy }} hitSlop={4} style={[styles.refresh, { backgroundColor: t.dark ? "#29B35E" : "#014D3D" }]}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
            <Icon name="refresh" size={18} color={t.dark ? "#013D31" : "#fff"} stroke={2} />
          </Animated.View>
        </Pressable>
      </View>
      <PasswordSheet visible={pw} onClose={() => setPw(false)} onDone={() => toast("تم تغيير كلمة المرور", "ok")} />
      <BellPanel visible={panel} onClose={() => setPanel(false)} top={insets.top + 58} />
    </View>
  );
}

const KIND = {
  template: { bg: "rgba(66,133,244,.14)", fg: "#014D3D", icon: "file" },
  request: { bg: "rgba(214,158,46,.17)", fg: "#231F20", icon: "clock" },
  ok: { bg: "rgba(41,179,94,.17)", fg: "#1F8D49", icon: "checkCircle" },
  no: { bg: "rgba(181,74,74,.15)", fg: "#B54A4A", icon: "xCircle" },
} as const;

function ago(ts: string) {
  const d = new Date(ts);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  if (s < 172800) return "أمس";
  return d.toLocaleDateString("en-GB");
}

// V118 bell panel.
function BellPanel({ visible, onClose, top }: { visible: boolean; onClose: () => void; top: number }) {
  const t = useTheme();
  const { items, unread, markAllRead } = useBell();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.panel, { top, backgroundColor: t.c, borderColor: t.bd }]}>
          <View style={[styles.panelHead, { borderBottomColor: t.bd }]}>
            <T size={14} weight={800} style={{ flex: 1 }}>الإشعارات</T>
            {unread > 0 ? <View style={styles.newPill}><T size={12} weight={800} color="#B54A4A">{unread} جديد</T></View> : null}
            <Pressable disabled={!unread} onPress={markAllRead} accessibilityRole="button" hitSlop={8} style={{ opacity: unread ? 1 : 0.4, paddingHorizontal: 4 }}>
              <T size={12} weight={800} color={t.gr}>تعليم الكل كمقروء</T>
            </Pressable>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق" hitSlop={12}><T size={20} color={t.mu}>×</T></Pressable>
          </View>
          <ScrollView>
            {!items.length ? <T center color={t.mu} style={{ padding: 34 }}>لا توجد إشعارات.</T> : null}
            {items.map((n) => {
              const k = KIND[n.kind] ?? KIND.ok;
              const un = !n.is_read;
              return (
                <Pressable key={n.id} accessibilityRole="button" onPress={() => { onClose(); router.navigate(`/(tabs)/${n.target}` as never); }}
                  style={[styles.item, { borderBottomColor: t.bd, backgroundColor: un ? "rgba(41,179,94,.09)" : "transparent" }]}>
                  <View style={[styles.kind, { backgroundColor: k.bg }]}><Icon name={k.icon} size={18} color={k.fg} stroke={2} /></View>
                  <View style={{ flex: 1 }}>
                    <T size={12.5} weight={800}>{n.title}</T>
                    {n.body ? <T size={12} color={t.mu} numberOfLines={3} style={{ marginTop: 2 }}>{n.body}</T> : null}
                    <T size={12} color={t.mu} style={{ marginTop: 3 }}>{ago(n.at)}</T>
                  </View>
                  {un ? <View style={styles.dot} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type NavRoute = { key: string; name: string };
type BottomTabBarProps = { state: { index: number; routes: NavRoute[] }; navigation: { navigate: (name: string) => void } };

const NAV_W = 62, NAV_GAP = 2, NAV_PAD = 4;

function BottomNav({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { letters, approvals } = useData();
  const reduced = useReducedMotion();
  const solid = useReducedTransparency() || Platform.OS === "android"; // Android: no real blur, an opaque bar keeps the elevation shadow clean
  const list = useRef<FlatList<(typeof TABS)[number]>>(null);
  const pendingDocs = letters.filter((l) => l.status === "pending").length;
  const visible = TABS.filter((x) => x.name !== "approvals" || APPROVERS.includes(user?.role ?? ""));
  const activeName = state.routes[state.index]?.name;
  const activeIdx = visible.findIndex((x) => x.name === activeName);
  // Ten tabs do not fit: keep the active one in view (it sat off-screen for «عمل إضافي» / «مستندات» / «الموافقات»).
  useEffect(() => {
    if (activeIdx >= 0) list.current?.scrollToIndex({ index: activeIdx, viewPosition: 0.5, animated: !reduced });
  }, [activeIdx, reduced]);
  return (
    <View style={[styles.bnav, { bottom: 10 + insets.bottom / 2, borderColor: "rgba(1,77,61,.10)" }]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 23, overflow: "hidden", backgroundColor: solid ? t.c : rgba(t.c, 0.72) }]}>
        {solid ? null : <BlurView intensity={50} tint={t.dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      </View>
      <FlatList
        ref={list}
        data={visible}
        horizontal
        keyExtractor={(x) => x.name}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: NAV_PAD }}
        getItemLayout={(_, i) => ({ length: NAV_W + NAV_GAP, offset: NAV_PAD + i * (NAV_W + NAV_GAP), index: i })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item: tab }) => {
          const route = state.routes.find((r) => r.name === tab.name);
          const on = !!route && state.routes[state.index]?.key === route.key;
          const color = on ? (t.dark ? "#29B35E" : "#014D3D") : t.mu;
          const count = tab.name === "documents" ? pendingDocs : tab.name === "approvals" ? approvals.length : 0;
          return (
            <Pressable onPress={() => route && navigation.navigate(route.name)}
              accessibilityRole="tab" accessibilityState={{ selected: on }}
              accessibilityLabel={count > 0 ? `${tab.label}، ${count}` : tab.label}
              style={[styles.bni, on && { backgroundColor: t.dark ? "rgba(41,179,94,.20)" : "rgba(1,77,61,.10)" }]}>
              <View style={on && !reduced ? { transform: [{ translateY: -1 }, { scale: 1.08 }] } : undefined}><Icon name={tab.icon} size={22} color={color} /></View>
              <T size={12} weight={700} color={color} numberOfLines={1}>{tab.label}</T>
              {count > 0 ? <View style={[styles.navBadge, { backgroundColor: tab.name === "approvals" ? t.rd : "#B54A4A" }]}><T size={12} weight={700} color="#fff">{count}</T></View> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** Their BioAsk: once, after signing in with «تذكرني», offer Face ID / fingerprint sign-in on this device. */
function BioAsk() {
  const toast = useToast();
  useEffect(() => {
    (async () => {
      if (!(await remembered()) || !(await biometricAvailable()) || (await biometricEnabled()) || (await wasNudged())) return;
      await setNudged();
      Alert.alert("🔐 تفعيل الدخول بالبصمة؟", "بدل كتابة كلمة المرور كل مرة، تدخل بالبصمة أو Face ID على هذا الجهاز.", [
        { text: "مش دلوقتي", style: "cancel" },
        { text: "تفعيل", onPress: async () => { const rt = await getRefreshToken(); if (!rt) return; const r = await enableBiometric(rt); toast(r.msg, r.ok ? "ok" : "err"); } },
      ]);
    })();
  }, [toast]);
  return null;
}

export default function TabsLayout() {
  return (
    <PunchProvider>
      <BioAsk />
      <Tabs tabBar={(p) => <BottomNav {...(p as unknown as BottomTabBarProps)} />} screenOptions={({ route }) => ({
        header: () => <Header title={TABS.find((x) => x.name === route.name)?.title ?? ""} />,
      })}>
        {TABS.map((x) => <Tabs.Screen key={x.name} name={x.name} options={{ title: x.title }} />)}
      </Tabs>
    </PunchProvider>
  );
}

const styles = StyleSheet.create({
  hdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1,
    ...shadow("#014D3D", 0.06, 7, 0, 2, 2), zIndex: 10 },
  ib: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#B54A4A", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2 },
  mode: { height: 36, minWidth: 36, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  refresh: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bnav: { position: "absolute", left: 10, right: 10, borderRadius: 24, borderWidth: 1, paddingVertical: 6,
    ...shadow("#014D3D", 0.18, 17, 0, 12, 8) },
  bni: { width: NAV_W, marginEnd: NAV_GAP, alignItems: "center", gap: 3, paddingTop: 7, paddingBottom: 6, paddingHorizontal: 4, borderRadius: 18 },
  navBadge: { position: "absolute", top: 0, right: 10, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  panel: { position: "absolute", left: 8, right: 8, maxHeight: "76%", borderWidth: 1, borderRadius: 18, overflow: "hidden",
    ...shadow("#000", 0.28, 25, 0, 18, 10) },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  newPill: { backgroundColor: "rgba(214,69,69,.13)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  item: { flexDirection: "row", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, alignItems: "flex-start" },
  kind: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B54A4A", marginTop: 7 },
});
