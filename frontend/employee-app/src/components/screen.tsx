// A full screen opened from a tab (their modals / overlays): back button, title, scrolling content.
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Icon } from "./icons";
import { T } from "./ui";
import { useTheme } from "@/theme";

export function Screen({ title, children, scroll = true }: { title: string; children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: insets.top + 10, paddingBottom: 10, paddingHorizontal: 14,
        backgroundColor: t.c, borderBottomWidth: 1, borderBottomColor: t.bd }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="رجوع"
          style={{ width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: t.bd, backgroundColor: t.c2, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={18} color={t.tx} />
        </Pressable>
        <T size={16} weight={800} style={{ flex: 1 }} numberOfLines={1}>{title}</T>
      </View>
      {scroll ? <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}
    </View>
  );
}
