// Themed text, kept apart from ui.tsx so date-time.tsx can use it without a circular import (ui.tsx -> date-time.tsx -> ui.tsx).
import type { ReactNode } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { fonts, useTheme } from "@/theme";

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
