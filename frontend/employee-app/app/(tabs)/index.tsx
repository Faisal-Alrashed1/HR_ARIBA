// الرئيسية — legacy V118 home (js/core-ui/030 hero + tiles + quick actions) over 018.renderHome (بياناتي، آخر راتب معتمد)
// and V122 «جهة العمل ومواقع العمل».
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";
import { Icon, type IconName } from "@/components/icons";
import { useComposer } from "@/components/composer";
import { ForgotPunchSheet, LocationsCard, sar } from "@/components/shared";
import { Card, Page, T } from "@/components/ui";
import { RequestItem } from "@/components/request-item";
import { useData } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { distanceText } from "@/lib/geo";
import { riyadhParts, todaySessions, usePunch, workedMinutes } from "@/lib/punch";
import { useTheme } from "@/theme";
import { shadow } from "@/lib/shadow";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function shortName(full: string) {
  const w = full.trim().split(/\s+/);
  if (w.length <= 2) return full;
  const first = w[0] === "عبد" || w[0] === "أبو" ? `${w[0]} ${w[1]}` : w[0];
  return `${first} ${w[w.length - 1]}`;
}

const DIAL = 176;
const R = 80;

// The one bright action of the screen: a lime key (sand once you are in, quiet once the day is done) in a ring that fills with the worked hours.
function Dial({ state, progress, onPress, busy }: { state: "in" | "out" | "done"; progress: number; onPress: () => void; busy: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state === "done" || busy) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [state, busy, pulse]);
  const fill = { in: "#29B35E", out: "#E4E4BC", done: "rgba(255,255,255,.22)" }[state];
  const ink = state === "in" ? "#012A21" : state === "out" ? "#231F20" : "#E8F2ED";
  const label = { in: "سجّل حضورك", out: "سجّل انصرافك", done: "تم الانصراف" }[state];
  const icon = { in: "fingerprint", out: "exit", done: "checkCircle" }[state] as IconName;
  const c = 2 * Math.PI * R;
  const inner = DIAL - 32;
  return (
    <View style={{ width: DIAL, height: DIAL, alignSelf: "center", marginTop: 12, marginBottom: 4, alignItems: "center", justifyContent: "center" }}>
      <Svg width={DIAL} height={DIAL} style={StyleSheet.absoluteFill}>
        <Circle cx={DIAL / 2} cy={DIAL / 2} r={R} stroke="rgba(255,255,255,.16)" strokeWidth={6} fill="none" />
        <Circle cx={DIAL / 2} cy={DIAL / 2} r={R} stroke="#29B35E" strokeWidth={6} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * Math.min(1, progress)} ${c}`} transform={`rotate(-90 ${DIAL / 2} ${DIAL / 2})`} />
      </Svg>
      {state !== "done" && !busy ? (
        <Animated.View style={{ pointerEvents: "none", position: "absolute", width: inner, height: inner, borderRadius: inner / 2, borderWidth: 2, borderColor: fill,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }] }} />
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy || state === "done"}
        style={({ pressed }) => ({ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: fill, alignItems: "center", justifyContent: "center",
          transform: [{ scale: pressed ? 0.95 : 1 }], opacity: busy ? 0.7 : 1, ...shadow("#000", 0.35, 14, 0, 12, 8) })}>
        {busy ? <T size={15} weight={800} color={ink}>...</T> : (
          <View style={{ alignItems: "center" }}>
            <Icon name={icon} size={42} color={ink} stroke={1.9} />
            <T size={15} weight={800} color={ink} style={{ marginTop: 4 }}>{label}</T>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function Chip({ text, tone, icon }: { text: string; tone?: "ok" | "bad"; icon: "pin" | "flag" | "clock" }) {
  const color = tone === "bad" ? "#FFB4AA" : "#fff";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,.12)" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone === "bad" ? "#FF8A7E" : "#29B35E" }} />
      <Icon name={icon} size={13} color={color} stroke={2} />
      <T size={12} weight={600} color={color}>{text}</T>
    </View>
  );
}

function Hero({ onForgot }: { onForgot: () => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const now = useNow();
  const { employee, att } = useData();
  const { loc, punch, busy } = usePunch();
  const r = riyadhParts(now);
  const { rows, open, lastOut } = todaySessions(att);
  const state = !rows.length ? "in" : open ? "out" : "done";
  const worked = workedMinutes(rows, r.minutes);
  const shift = (att?.shift_hours ?? 8) * 60;
  const fg = "#fff";
  const h12 = r.h % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = now.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const name = employee?.name_ar ?? "";
  const locChip = (() => {
    switch (loc.kind) {
      case "loading": return { text: "جاري تحديد موقعك…" };
      case "inside": return { text: `داخل نطاق: ${loc.name}`, tone: "ok" as const };
      case "outside": return { text: `خارج النطاق — أقرب موقع ${loc.name} (${distanceText(loc.distance)})`, tone: "bad" as const };
      case "denied": return { text: "فعّل صلاحية الموقع", tone: "bad" as const };
      case "unset": return { text: "إحداثيات موقع عملك غير مضبوطة", tone: "bad" as const };
      case "none": return { text: "لا يوجد موقع عمل", tone: "bad" as const };
      default: return { text: "تعذر تحديد الموقع", tone: "bad" as const };
    }
  })();

  return (
    <View style={styles.hero} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* the artwork (gradient + slanted ribbons) is the only green: drawn at the card's measured size (not "100%") so it covers the whole card and all its text, however tall the content grows */}
      {box.w > 0 ? (
        <Svg style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]} width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`}>
          <Defs>
            <LinearGradient id="heroBg" x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor="#01392D" />
              <Stop offset="0.55" stopColor="#014D3D" />
              <Stop offset="1" stopColor="#0B6B4F" />
            </LinearGradient>
            <LinearGradient id="band1" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#29B35E" stopOpacity="0" /><Stop offset="1" stopColor="#29B35E" stopOpacity="0.4" /></LinearGradient>
            <LinearGradient id="band2" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#E4E4BC" stopOpacity="0" /><Stop offset="1" stopColor="#E4E4BC" stopOpacity="0.2" /></LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={box.w} height={box.h} fill="url(#heroBg)" />
          <Polygon points={`0,${box.h * 0.26} ${box.w},${box.h * 0.04} ${box.w},${box.h * 0.17} 0,${box.h * 0.39}`} fill="url(#band1)" />
          <Polygon points={`0,${box.h * 0.84} ${box.w},${box.h * 0.66} ${box.w},${box.h * 0.74} 0,${box.h * 0.92}`} fill="url(#band2)" />
        </Svg>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View style={styles.avatar}>
          <T size={19} weight={800} color="#E4E4BC">{name.charAt(0)}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T size={12.5} color={fg} style={{ opacity: 0.78 }}>{r.h < 12 ? "صباح الخير" : "مساء الخير"}</T>
          <T size={18} weight={800} color={fg} numberOfLines={1} style={{ letterSpacing: -0.3 }}>{shortName(name)}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row", direction: "ltr", alignItems: "baseline", justifyContent: "center", marginTop: 14, gap: 6 }}>
        <T size={52} weight={300} color={fg} style={{ letterSpacing: -2 }}>{`${pad(h12)}:${pad(r.m)}`}</T>
        <T size={20} weight={300} color={fg} style={{ opacity: 0.7 }}>{`\u200E:${pad(r.s)}`}</T>
        <T size={14} weight={700} color={fg} style={{ opacity: 0.75 }}>{r.h < 12 ? "ص" : "م"}</T>
      </View>
      <T size={12.5} color={fg} center style={{ opacity: 0.78 }}>{date}</T>
      <Dial state={state} progress={worked / shift} busy={busy} onPress={() => punch(state === "in" ? "in" : "out")} />
      <View style={styles.chips}>
        <Chip icon="pin" text={locChip.text} tone={locChip.tone} />
        {open && att?.flexible_enabled && att.expected_checkout ? <Chip icon="flag" text={`الانصراف المتوقع ${att.expected_checkout}`} /> : null}
        {rows.length ? <Chip icon="clock" text={`ساعات اليوم ${Math.floor(worked / 60)}س ${String(worked % 60).padStart(2, "0")}د`} /> : null}
      </View>
      {rows.length ? (
        <View style={[styles.chips, { marginTop: 8 }]}>
          {rows.map((s, i) => (
            <View key={i} style={{ backgroundColor: "rgba(255,255,255,.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <T size={11.5} weight={700} color={fg}>{`${s.time_in} → ${s.time_out ?? "…"}`}</T>
            </View>
          ))}
        </View>
      ) : null}
      {state === "done" ? (
        <Pressable onPress={() => punch("in")} disabled={busy} style={[styles.back, { borderColor: fg }]}>
          <Icon name="back" size={15} color={fg} stroke={2} />
          <T size={12.5} weight={800} color={fg}>رجوع للعمل — تسجيل حضور مرة أخرى</T>
        </Pressable>
      ) : null}
      {lastOut && open && rows.length > 1 ? <T size={11} color={fg} center style={{ marginTop: 6, opacity: 0.8 }}>رجعت للعمل بعد انصراف الساعة {lastOut}</T> : null}
      <Pressable onPress={onForgot} style={{ alignSelf: "center", marginTop: 8 }}><T size={12} weight={600} color={fg} style={{ opacity: 0.8 }}>نسيت البصمة؟</T></Pressable>
    </View>
  );
}

function Ledger({ items }: { items: [string, string][] }) {
  const t = useTheme();
  return (
    <View style={[styles.ledger, { backgroundColor: t.c }]}>
      {items.map(([v, l], i) => (
        <View key={l} style={[styles.ledgerCell, i > 0 && { borderStartWidth: StyleSheet.hairlineWidth, borderStartColor: t.bd }]}>
          <T size={26} weight={300} style={{ letterSpacing: -0.8 }}>{v}</T>
          <T size={12} color={t.mu} center>{l}</T>
        </View>
      ))}
    </View>
  );
}

// Every screen of the app is one tap from here (the dock keeps only five places).
function Service({ label, icon, onPress, badge, wide }: { label: string; icon: IconName; onPress: () => void; badge?: number; wide?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.svc, wide && styles.svcWide, { backgroundColor: t.c, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={[styles.svcIc, { backgroundColor: t.c2 }]}><Icon name={icon} size={21} color={t.dark ? "#29B35E" : "#014D3D"} /></View>
      <T size={12} weight={700} center numberOfLines={2}>{label}</T>
      {badge ? <View style={styles.svcBadge}><T size={10} weight={800} color="#fff">{badge}</T></View> : null}
    </Pressable>
  );
}

function Mini({ label, value }: { label: string; value?: string | null }) {
  const t = useTheme();
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, backgroundColor: t.c2, borderRadius: 8, padding: 8 }}>
      <T size={10} color={t.mu}>{label}</T>
      <T size={12} weight={700} style={{ marginTop: 2 }} numberOfLines={1}>{value || "—"}</T>
    </View>
  );
}

export default function Home() {
  const t = useTheme();
  const { open } = useComposer();
  const { user } = useAuth();
  const { employee, leave, att, payslips, letters, approvals, requests, refresh } = useData();
  const [forgot, setForgot] = useState(false);
  const last = payslips[0];
  const fmt = (n: number | undefined) => (n == null ? "—" : String(Math.round(n * 100) / 100));
  const go = (p: string) => router.navigate(p as never);
  const isApprover = ["manager", "hr", "ceo", "admin", "admin_manager", "chairman"].includes(user?.role ?? "");
  const pendingDocs = letters.filter((l) => l.status === "pending").length;
  const services: { icon: IconName; label: string; onPress: () => void; badge?: number }[] = [
    { icon: "calendar", label: "طلب إجازة", onPress: () => open("annual") },
    { icon: "clock", label: "استئذان", onPress: () => open("permission") },
    { icon: "cash", label: "سلفة", onPress: () => open("advance") },
    { icon: "stopwatch", label: "عمل إضافي", onPress: () => go("/(tabs)/overtime") },
    { icon: "fingerprint", label: "نسيت بصمة", onPress: () => setForgot(true) },
    { icon: "file", label: "مستنداتي", onPress: () => go("/(tabs)/documents"), badge: pendingDocs },
    { icon: "history", label: "سجل الحضور", onPress: () => go("/(tabs)/attendance") },
    { icon: "star", label: "أهدافي", onPress: () => go("/(tabs)/goals") },
    { icon: "users", label: "فريقي", onPress: () => go("/(tabs)/team") },
    ...(isApprover ? [{ icon: "checks" as IconName, label: "الموافقات", onPress: () => go("/(tabs)/approvals"), badge: approvals.length }] : []),
  ];
  const running = requests.filter((r) => r.status === "pending").slice(0, 2);
  return (
    <Page onRefresh={refresh}>
      <Hero onForgot={() => setForgot(true)} />
      <Ledger items={[[fmt(leave?.current), "رصيد الإجازة (يوم)"], [fmt(leave?.year_end), "رصيد نهاية العام"], [att ? String(Math.max(0, att.remote_limit - att.remote_used)) : "—", "عن بعد المتبقي"]]} />

      <T size={16} weight={800} style={styles.sec}>ماذا تحتاج اليوم؟</T>
      <View style={styles.svcGrid}>
        {services.map((x, i) => <Service key={x.label} {...x} wide={services.length % 3 === 1 && i === services.length - 1} />)}
      </View>

      {running.length ? (
        <>
          <T size={16} weight={800} style={styles.sec}>طلباتك الجارية</T>
          <Card>{running.map((r) => <RequestItem key={r.id} r={r} />)}</Card>
        </>
      ) : null}

      <T size={16} weight={800} style={styles.sec}>بياناتي</T>
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Mini label="جهة العمل" value={employee?.workplace?.name_ar} />
          <Mini label="القسم" value={employee?.department?.name_ar} />
          <Mini label="الجنسية" value={employee?.nationality?.name_ar} />
          <Mini label="الوظيفة" value={employee?.job_title} />
        </View>
      </Card>
      <Card>
        <T size={16} weight={700} style={{ marginBottom: 10 }}>آخر راتب معتمد</T>
        {last ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T weight={700}>{`${last.year}/${String(last.month).padStart(2, "0")}`}</T>
            <T size={18} weight={700} color={t.gr}>{sar(last.data.netSAR ?? last.data.net)}</T>
          </View>
        ) : <T color={t.mu}>لا يوجد مسير معتمد</T>}
      </Card>
      <LocationsCard />
      <ForgotPunchSheet visible={forgot} onClose={() => setForgot(false)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 30, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 18, overflow: "hidden", marginBottom: 14, ...shadow("#014D3D", 0.3, 16, 0, 14, 6) },
  avatar: { width: 46, height: 46, backgroundColor: "rgba(255,255,255,.14)", borderRadius: 16, alignItems: "center", justifyContent: "center", transform: [{ skewX: "-8deg" }] },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginTop: 6 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", marginTop: 10, borderWidth: 1.5, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderColor: "#fff" },
  ledger: { flexDirection: "row", borderRadius: 22, overflow: "hidden", marginBottom: 6, ...shadow("#014D3D", 0.08, 8, 0, 4, 2) },
  ledgerCell: { flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 6, gap: 2 },
  sec: { marginTop: 18, marginBottom: 10, marginHorizontal: 2, letterSpacing: -0.3 },
  svcGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  svc: { width: "31.6%", alignItems: "center", gap: 8, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 3, borderRadius: 18, minHeight: 92, ...shadow("#014D3D", 0.08, 8, 0, 4, 2) },
  svcWide: { width: "100%", flexDirection: "row", minHeight: 64, justifyContent: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  svcIc: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  svcBadge: { position: "absolute", top: 6, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#B3342B", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
});
