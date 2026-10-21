// Haptics for the moments that earn them (a punch, a sent request, an error, a tab change) — nothing on the web.
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const on = Platform.OS !== "web";
const run = (fn: () => Promise<void>) => { if (on) fn().catch(() => {}); };

export const tap = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const press = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const success = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
export const select = () => run(() => Haptics.selectionAsync());
