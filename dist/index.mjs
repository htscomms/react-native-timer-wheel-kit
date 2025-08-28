import { useState, useRef, useMemo, useEffect } from 'react';
import { Animated, StyleSheet, PanResponder, View, Text, Easing, Platform, Vibration } from 'react-native';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';

// src/logic/CountdownTimer.ts
var CountdownTimer = class {
  /** - Parameter start: initial value in seconds. */
  constructor(start) {
    this.intervalId = null;
    this.listeners = /* @__PURE__ */ new Set();
    this.remainingInternal = Math.max(0, Math.floor(start || 0));
    this.startCountdown();
  }
  /** Remaining time in seconds (read-only) */
  get remaining() {
    return this.remainingInternal;
  }
  /** Start the downward count. */
  startCountdown() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      if (this.remainingInternal > 0) {
        this.remainingInternal -= 1;
        this.emit();
      }
    }, 1e3);
  }
  /** Extend (or shorten) the timer. Accepts negative seconds. */
  extend(bySeconds) {
    this.remainingInternal = Math.max(0, this.remainingInternal + Math.floor(bySeconds));
    this.emit();
  }
  /** Subscribe to remaining changes (emits immediately). */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.remainingInternal);
    return () => this.listeners.delete(listener);
  }
  /** Stop and dispose. */
  dispose() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.listeners.clear();
  }
  emit() {
    for (const l of this.listeners) l(this.remainingInternal);
  }
};

// src/logic/TimerViewModel.ts
var TimerViewModel = class {
  /** Remaining seconds (read-only) */
  get remainingSeconds() {
    return this.remainingSecondsInternal;
  }
  /** Init (defaults to 30 minutes) */
  constructor(startMinutes = 30) {
    const secs = Math.max(0, Math.floor(startMinutes * 60));
    this.timer = new CountdownTimer(secs);
    this.remainingSecondsInternal = secs;
    this.unsub = this.timer.subscribe((s) => this.remainingSecondsInternal = s);
  }
  /** Add (or subtract) minutes. Accepts negatives. */
  extend(minutes) {
    this.timer.extend(minutes * 60);
  }
  /** MM:SS string suitable for a monospaced label. */
  get timeString() {
    const m = Math.floor(this.remainingSecondsInternal / 60);
    const s = this.remainingSecondsInternal % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  /** Subscribe to changes. Emits immediately. */
  subscribe(listener) {
    listener(this.remainingSecondsInternal);
    return this.timer.subscribe((s) => listener(this.remainingSecondsInternal = s));
  }
  dispose() {
    this.unsub?.();
    this.timer.dispose();
  }
};

// src/ui/TimerWheelConfig.ts
var defaultConfig = {
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
function tickHaptic() {
  if (Platform.OS === "android") Vibration.vibrate(5);
  else Vibration.vibrate(5);
}
function successHaptic() {
  if (Platform.OS === "android") Vibration.vibrate([0, 12, 30, 18]);
  else Vibration.vibrate([0, 10, 50, 10]);
}
var TimerWheelView = ({
  config: cfg,
  onRequestPayment,
  size = 260
}) => {
  const config = { ...defaultConfig, ...cfg || {} };
  const [radius, setRadius] = useState(size / 2);
  const [centre, setCentre] = useState({ x: size / 2, y: size / 2 });
  const cumAngle = useRef(0);
  const lastAngle = useRef(null);
  const liveDeltaMins = useRef(0);
  const [uiDelta, setUiDelta] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const snapIndex = useRef(0);
  const styles = useMemo(
    () => StyleSheet.create({
      root: { width: size, height: size, alignItems: "center", justifyContent: "center" },
      ring: {
        position: "absolute",
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: config.ringLineWidth,
        borderColor: "rgba(128,128,128,0.65)"
      },
      innerDisc: {
        position: "absolute",
        left: config.ringLineWidth,
        top: config.ringLineWidth,
        width: size - config.ringLineWidth * 2,
        height: size - config.ringLineWidth * 2,
        borderRadius: (size - config.ringLineWidth * 2) / 2,
        backgroundColor: "rgba(118,118,118,0.06)"
      },
      innerOutline: {
        position: "absolute",
        width: radius,
        height: radius,
        borderRadius: radius / 2,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.25)"
      },
      overlayWrap: { alignItems: "center", justifyContent: "center" },
      capsuleTrack: {
        width: config.overlayBarWidth,
        height: config.overlayBarHeight,
        borderRadius: config.overlayBarHeight / 2,
        backgroundColor: "rgba(0,0,0,0.2)",
        overflow: "hidden"
      },
      capsuleFill: {
        height: config.overlayBarHeight,
        borderRadius: config.overlayBarHeight / 2,
        backgroundColor: "#0a84ff"
      },
      resetIcon: { fontSize: 28, fontWeight: "600", opacity: 0.6 }
    }),
    [size, radius, config]
  );
  function onLayout(e) {
    const w = e.nativeEvent.layout.width;
    const h = e.nativeEvent.layout.height;
    setRadius(w / 2);
    setCentre({ x: w / 2, y: h / 2 });
  }
  function vecToAngle(x, y) {
    const dx = x - centre.x;
    const dy = y - centre.y;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }
  function applyDelta(delta) {
    let adjustedDelta = delta;
    if (adjustedDelta > 180) adjustedDelta -= 360;
    if (adjustedDelta < -180) adjustedDelta += 360;
    const tentativeCumAngle = cumAngle.current + adjustedDelta;
    const steps = tentativeCumAngle / config.snapDegree;
    let mins = Math.round(steps) * config.minuteStep;
    if (config.maxMinutes > 0) {
      if (mins > config.maxMinutes) mins = config.maxMinutes;
      if (mins < -config.maxMinutes) mins = -config.maxMinutes;
    }
    if (!config.allowsNegative && mins < 0) mins = 0;
    const current = liveDeltaMins.current;
    const atPos = config.maxMinutes > 0 && current === config.maxMinutes;
    const atNeg = config.maxMinutes > 0 && current === -config.maxMinutes;
    const atZeroBound = !config.allowsNegative && current === 0;
    let discard = false;
    if (atPos && adjustedDelta > 0) discard = true;
    else if (atNeg && adjustedDelta < 0) discard = true;
    else if (atZeroBound && adjustedDelta < 0) discard = true;
    if (discard) {
      liveDeltaMins.current = mins;
      setUiDelta(mins);
      setShowOverlay(true);
      return;
    }
    cumAngle.current += adjustedDelta;
    wheelRotation.setValue(cumAngle.current);
    const newSnap = Math.round(cumAngle.current / config.snapDegree);
    const atAnyBound = config.maxMinutes > 0 && (mins === config.maxMinutes || mins === -config.maxMinutes) || !config.allowsNegative && mins === 0;
    if (newSnap !== snapIndex.current && !atAnyBound) {
      snapIndex.current = newSnap;
      tickHaptic();
    }
    liveDeltaMins.current = mins;
    setUiDelta(mins);
    setShowOverlay(true);
  }
  function handleRelease() {
    const minutes = liveDeltaMins.current;
    if (minutes === 0) {
      resetState();
      return;
    }
    Animated.spring(wheelRotation, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6
    }).start();
    barProgress.setValue(1);
    Animated.timing(barProgress, {
      toValue: 0,
      duration: 2e3,
      easing: Easing.linear,
      useNativeDriver: false
    }).start();
    const cost = Number((Math.abs(minutes) * config.costPerMinute).toFixed(2));
    setTimeout(() => {
      onRequestPayment(minutes, cost, (ok) => {
        if (ok) celebrate();
        else resetState();
      });
    }, 2e3);
    cumAngle.current = 0;
    lastAngle.current = null;
    snapIndex.current = 0;
  }
  function resetState() {
    setShowOverlay(false);
    setUiDelta(0);
    overlayOpacity.setValue(1);
    barProgress.setValue(0);
  }
  function celebrate() {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true
    }).start(() => {
      resetState();
    });
  }
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt, gs) => {
        if (!_evt.nativeEvent) return;
        const angle = vecToAngle(_evt.nativeEvent.locationX, _evt.nativeEvent.locationY);
        if (lastAngle.current === null) {
          lastAngle.current = angle;
          return;
        }
        const delta = angle - lastAngle.current;
        lastAngle.current = angle;
        applyDelta(delta);
      },
      onPanResponderRelease: () => handleRelease(),
      onPanResponderTerminate: () => handleRelease()
    })
  ).current;
  const ringTransform = {
    transform: [
      {
        rotate: wheelRotation.interpolate({
          inputRange: [-360, 360],
          outputRange: ["-360deg", "360deg"]
        })
      }
    ]
  };
  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, config.overlayBarWidth]
  });
  return /* @__PURE__ */ jsxs(View, { style: styles.root, onLayout, ...panResponder.panHandlers, children: [
    /* @__PURE__ */ jsx(Animated.View, { style: [styles.ring, ringTransform] }),
    /* @__PURE__ */ jsx(View, { style: styles.innerDisc }),
    /* @__PURE__ */ jsx(View, { style: styles.innerOutline }),
    /* @__PURE__ */ jsx(Animated.View, { style: [styles.overlayWrap, { opacity: overlayOpacity }], children: showOverlay && uiDelta !== 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(Text, { style: { fontSize: 24, fontWeight: "700" }, children: uiDelta > 0 ? `+${uiDelta} m` : `${uiDelta} m` }),
      /* @__PURE__ */ jsxs(Text, { style: { fontSize: 16, opacity: 0.8 }, children: [
        uiDelta >= 0 ? "+" : "\u2013",
        "$",
        Math.abs(uiDelta * config.costPerMinute).toFixed(2)
      ] }),
      /* @__PURE__ */ jsx(View, { style: styles.capsuleTrack, children: /* @__PURE__ */ jsx(Animated.View, { style: [styles.capsuleFill, { width: barWidth }] }) })
    ] }) : /* @__PURE__ */ jsx(Text, { style: styles.resetIcon, children: "\u21BB" }) })
  ] });
};
var WheelTimer = ({
  startMinutes = 30,
  wheelConfig,
  onRequestPayment,
  size = 260
}) => {
  const config = { ...defaultConfig, ...wheelConfig || {} };
  const vmRef = useRef(void 0);
  if (!vmRef.current) vmRef.current = new TimerViewModel(startMinutes);
  const [remaining, setRemaining] = useState(vmRef.current.remainingSeconds);
  const [timeStr, setTimeStr] = useState(vmRef.current.timeString);
  useEffect(() => {
    const unsub = vmRef.current.subscribe((secs) => {
      setRemaining(secs);
      setTimeStr(vmRef.current.timeString);
    });
    return () => unsub();
  }, []);
  const flash = useRef(new Animated.Value(0)).current;
  const flashDuration = 600;
  const [confettiSeed, setConfettiSeed] = useState(0);
  function startCelebration(addMinutes) {
    flash.setValue(0);
    Animated.timing(flash, {
      toValue: 1,
      duration: flashDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start(() => flash.setValue(0));
    if (config.shouldPlaySuccessHaptic) successHaptic();
    setConfettiSeed((s2) => s2 + 1);
    setTimeout(() => {
      vmRef.current?.extend(addMinutes);
    }, flashDuration);
  }
  const onWheelRequest = (mins, cost, completion) => {
    onRequestPayment(mins, cost, (ok) => {
      completion(ok);
      if (ok) {
        setTimeout(() => startCelebration(mins), 0);
      }
    });
  };
  const s = useMemo(
    () => StyleSheet.create({
      container: { flex: 0, padding: 16, alignItems: "center" },
      title: { fontSize: 14, fontWeight: "700", opacity: 0.7, marginTop: 4, letterSpacing: 1 },
      timer: { fontSize: 72, fontWeight: "800", fontVariant: ["tabular-nums"], marginVertical: 8 },
      hint: { fontSize: 14, opacity: 0.7, textAlign: "center", marginTop: 8, marginBottom: 16 },
      row: { alignItems: "center" },
      flashOverlay: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(0,255,120,0.18)"
      }
    }),
    []
  );
  const flashStyle = {
    transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
    opacity: flash
  };
  return /* @__PURE__ */ jsxs(View, { style: s.container, children: [
    /* @__PURE__ */ jsx(Text, { style: s.title, children: "TIME REMAINING" }),
    /* @__PURE__ */ jsxs(View, { children: [
      /* @__PURE__ */ jsx(Text, { style: s.timer, children: timeStr }),
      /* @__PURE__ */ jsx(Animated.View, { pointerEvents: "none", style: [s.flashOverlay, flashStyle] })
    ] }),
    /* @__PURE__ */ jsx(Text, { style: s.hint, children: "Spin the dial to extend your booking" }),
    /* @__PURE__ */ jsx(ConfettiLite, { seed: confettiSeed }),
    /* @__PURE__ */ jsx(View, { style: s.row, children: /* @__PURE__ */ jsx(TimerWheelView, { size, config, onRequestPayment: onWheelRequest }) })
  ] });
};
var ConfettiLite = ({ seed }) => {
  const pieces = Array.from({ length: 40 }, (_, i) => i + seed);
  return /* @__PURE__ */ jsx(View, { pointerEvents: "none", style: { position: "absolute", width: "100%", height: "100%" }, children: pieces.map((k) => /* @__PURE__ */ jsx(ConfettiPiece, {}, k)) });
};
var ConfettiPiece = () => {
  const x = useRef(new Animated.Value(Math.random() * 300 - 150)).current;
  const y = useRef(new Animated.Value(-Math.random() * 200 - 20)).current;
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 500, duration: 1200 + Math.random() * 800, useNativeDriver: true }),
      Animated.timing(r, { toValue: 1, duration: 1500, useNativeDriver: true })
    ]).start();
  }, [y, r]);
  const rotate = r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${Math.random() * 720 - 360}deg`] });
  const size = 6 + Math.random() * 6;
  const bg = ["#34d399", "#10b981", "#22d3ee", "#a78bfa"][Math.floor(Math.random() * 4)];
  return /* @__PURE__ */ jsx(
    Animated.View,
    {
      style: {
        position: "absolute",
        left: "50%",
        top: 0,
        width: size,
        height: size,
        backgroundColor: bg,
        transform: [{ translateX: x }, { translateY: y }, { rotate }]
      }
    }
  );
};

export { CountdownTimer, TimerViewModel, TimerWheelView, WheelTimer, defaultConfig };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map