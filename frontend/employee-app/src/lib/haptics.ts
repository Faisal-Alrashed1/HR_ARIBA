// One haptic per user action, paired with a visual. No-op on web and when the device has no haptic engine.
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const native = Platform.OS !== "web";
const run = (f: () => Promise<void>) => { if (native) f().catch(() => {}); };

export const haptic = {
  /** A step / detent: opening a sheet, picking a value. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Something committed or snapped home. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  ok: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  err: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
