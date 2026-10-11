// Building blocks with the legacy employee app's final look (css/02-styles.css + V118 js/core-ui/030 overrides):
// .card, .card-title, .btn(-success|-danger|-primary), .b badges, label/input, .hr-pay-row, .profile-info, toast.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle, RefreshControl,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { brand, fonts, useTheme } from "@/theme";
import { Icon, type IconName } from "./icons";

export function T({ children, size = 13, weight = 500, color, style, numberOfLines, center }: {
  children: ReactNode; size?: number; weight?: 300 | 500 | 600 | 700 | 800 | 900; color?: string; style?: StyleProp<TextStyle>;
  numberOfLines?: number; center?: boolean;
}) {
  const t = useTheme();
  const family = weight >= 700 ? fonts.bold : weight <= 300 ? fonts.light : fonts.medium;
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: color ?? t.tx, fontFamily: family, fontSize: size, textAlign: center ? "center" : "auto", writingDirection: "rtl" }, style]}>
      {children}
    </Text>
  );
}

export function Page({ children, onRefresh }: { children: ReactNode; onRefresh?: () => Promise<unknown> }) {
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={refreshing} tintColor={t.bl} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.c, borderColor: t.dark ? "rgba(255,255,255,.08)" : "rgba(1,77,61,.08)", shadowColor: t.dark ? "#000" : "#014D3D" }, style]}>
      {children}
    </View>
  );
}

export function CardTitle({ children, icon }: { children: ReactNode; icon?: ReactNode | IconName }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 }}>
      {typeof icon === "string" ? <Icon name={icon} size={18} color={t.dark ? brand.green : brand.dark} stroke={2} /> : icon}
      <T size={14} weight={800}>{children}</T>
    </View>
  );
}

type BtnKind = "success" | "danger" | "primary" | "ghost" | "teal";
export function Btn({ title, onPress, kind = "primary", busy, disabled, icon, style }: {
  title: string; onPress: () => void; kind?: BtnKind; busy?: boolean; disabled?: boolean; icon?: ReactNode | IconName; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = { success: t.gr, danger: t.rd, primary: t.dark ? "#29B35E" : "#014D3D", ghost: t.c2, teal: "#014D3D" }[kind];
  const fg = kind === "ghost" ? t.tx : (kind === "success" || kind === "primary") && t.dark ? "#013D31" : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === "ghost" && { borderWidth: 1, borderColor: t.bd, shadowOpacity: 0 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <>{typeof icon === "string" ? <Icon name={icon} size={17} color={fg} stroke={2} /> : icon}<T size={13} weight={800} color={fg}>{title}</T></>}
    </Pressable>
  );
}

export function Badge({ text, tone }: { text: string; tone: "bg" | "br" | "ba" | "bk" }) {
  const t = useTheme();
  const map = { bg: ["rgba(16,185,129,.15)", t.gr], br: ["rgba(239,68,68,.15)", t.rd], ba: ["rgba(245,158,11,.15)", t.am], bk: ["rgba(100,116,139,.15)", t.mu] }[tone];
  return (
    <View style={{ backgroundColor: map[0], borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
      <T size={11} weight={600} color={map[1]}>{text}</T>
    </View>
  );
}

// .hr-pay-row (js/payroll/019): label in --mu, bold value; total / deduction / net variants.
export function PayRow({ label, value, kind }: { label: string; value: string; kind?: "total" | "ded" | "net" }) {
  const t = useTheme();
  const color = kind === "total" ? t.gr : kind === "ded" ? t.rd : kind === "net" ? t.cy : t.tx;
  return (
    <View style={[styles.payRow, { borderBottomColor: "rgba(36,48,68,.25)" },
      kind === "total" && { marginTop: 6, borderTopWidth: 1, borderTopColor: t.bd },
      kind === "net" && { borderBottomWidth: 0, marginTop: 4, paddingTop: 12 }]}>
      <T size={kind === "net" ? 16 : kind === "total" ? 13 : 12} weight={kind === "net" ? 800 : 500} color={kind === "net" ? t.tx : t.mu}>{label}</T>
      <T size={kind === "net" ? 17 : kind === "total" ? 13 : 12} weight={kind === "net" ? 800 : 700} color={color}>{kind === "ded" ? `- ${value}` : value}</T>
    </View>
  );
}

// .profile-info box.
export function InfoBox({ label, value }: { label: string; value?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexBasis: "48%", flexGrow: 1, padding: 10, borderWidth: 1, borderColor: t.bd, borderRadius: 10, backgroundColor: t.c2 }}>
      <T size={10} color={t.mu}>{label}</T>
      <T size={12} weight={700} style={{ marginTop: 3 }}>{value || "—"}</T>
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <T size={11} weight={600} color={t.mu} style={{ marginTop: 8, marginBottom: 4 }}>{children}</T>;
}

export function Input(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ flex: 1 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={t.dm}
        {...rest}
        style={[styles.input, { borderColor: t.bd, backgroundColor: t.c2, color: t.tx, fontFamily: fonts.medium }, props.multiline && { minHeight: 64, textAlignVertical: "top" }, style]}
      />
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// <input type="date"> / <input type="time"> with the native pickers.
export function PickerField({ label, value, onChange, mode, maximumDate, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void; mode: "date" | "time"; maximumDate?: Date; placeholder?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = value ? (mode === "date" ? new Date(`${value}T12:00:00`) : new Date(`2000-01-01T${value}:00`)) : new Date();
  const set = (_: unknown, d?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (d) onChange(mode === "date" ? isoDate(d) : hhmm(d));
  };
  return (
    <View style={{ flex: 1 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable onPress={() => setOpen((o) => !o)} style={[styles.input, { borderColor: t.bd, backgroundColor: t.c2, justifyContent: "center" }]}>
        <T size={13} color={value ? t.tx : t.dm}>{value || placeholder || (mode === "date" ? "yyyy-mm-dd" : "--:--")}</T>
      </Pressable>
      {open ? (
        <View>
          <DateTimePicker value={current} mode={mode} display={Platform.OS === "ios" ? "spinner" : "default"} onChange={set} maximumDate={maximumDate} is24Hour locale="en-GB" />
          {Platform.OS === "ios" ? <Btn title="تم" kind="ghost" onPress={() => setOpen(false)} style={{ marginTop: 0 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
      <ActivityIndicator color={t.bl} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const t = useTheme();
  return <T center color={t.mu} style={{ padding: 18 }}>{text}</T>;
}

// White modal card of the legacy patches (forgot punch, change password): not themed, Tahoma-like look.
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --------------------------------------------------------------------------- toast (top, centred, 3 s)
type ToastKind = "ok" | "err" | "info";
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const [msg, setMsg] = useState<{ text: string; kind: ToastKind } | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, kind: ToastKind = "info") => {
    setMsg({ text, kind });
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, [fade]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: fade, backgroundColor: t.c, borderColor: msg.kind === "err" ? t.rd : msg.kind === "ok" ? t.gr : t.bd }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {msg.kind !== "info" ? <Icon name={msg.kind === "err" ? "xCircle" : "checkCircle"} size={18} color={msg.kind === "err" ? t.rd : t.gr} stroke={2} /> : null}
            <T size={13} center style={{ flexShrink: 1 }}>{msg.text}</T>
          </View>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, marginTop: 10,
    shadowColor: "#014D3D", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1 },
  input: { borderWidth: 1, borderRadius: 8, padding: 9, fontSize: 13, minHeight: 40, textAlign: "right" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 400, maxHeight: "92%" },
  toast: { position: "absolute", top: 54, alignSelf: "center", maxWidth: "90%", borderWidth: 1, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
