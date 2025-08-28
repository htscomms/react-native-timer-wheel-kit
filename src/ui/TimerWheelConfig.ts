export interface TimerWheelConfig {
  // Wheel mechanics
  minuteStep: number;
  snapDegree: number;           // degrees per notch
  costPerMinute: number;        // dollars
  allowsNegative: boolean;
  maxMinutes: number;           // 0 = unbounded

  // Ring appearance
  ringLineWidth: number;        // px
  ringGradient: string[];       // currently visualized as a solid mix

  // Overlay bar
  overlayBarWidth: number;      // px
  overlayBarHeight: number;     // px

  // Sound / Haptics
  tickSoundEnabled: boolean;    // sound hook is a no-op by default
  hapticSharpness: number;      // kept for parity
  hapticIntensity: number;
  shouldPlaySuccessHaptic: boolean;
}

export const defaultConfig: TimerWheelConfig = {
  minuteStep: 1,
  snapDegree: 15,
  costPerMinute: 0.35,
  allowsNegative: true,
  maxMinutes: 0,
  ringLineWidth: 40,
  ringGradient: ["rgba(128,128,128,0.4)", "rgba(128,128,128,0.9)"],
  overlayBarWidth: 75,
  overlayBarHeight: 6,
  tickSoundEnabled: true,
  hapticSharpness: 0.4,
  hapticIntensity: 0.6,
  shouldPlaySuccessHaptic: true
};
