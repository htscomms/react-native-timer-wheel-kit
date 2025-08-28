import { Platform, Vibration } from "react-native";

export function tickHaptic() {
  // a tiny pulse
  if (Platform.OS === "android") Vibration.vibrate(5);
  else Vibration.vibrate(5);
}

export function successHaptic() {
  if (Platform.OS === "android") Vibration.vibrate([0, 12, 30, 18]);
  else Vibration.vibrate([0, 10, 50, 10]); // double-tap-ish
}
