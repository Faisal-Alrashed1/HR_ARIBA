// «تقليل الحركة» of the device (iOS Reduce Motion / Android remove animations), followed live.
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setOn(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOn);
    return () => { alive = false; sub.remove(); };
  }, []);
  return on;
}

// iOS «تقليل الشفافية»: translucent chrome becomes solid. (Not available on Android: stays false there.)
export function useReducedTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => alive && setOn(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setOn);
    return () => { alive = false; sub.remove(); };
  }, []);
  return on;
}
