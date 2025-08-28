import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  StyleSheet,
  Text,
  View
} from "react-native";
import { defaultConfig, TimerWheelConfig } from "./TimerWheelConfig";
import { tickHaptic } from "./haptics";

export type PaymentRequest = (
  minutes: number,
  cost: number,
  completion: (ok: boolean) => void
) => void;

export interface TimerWheelViewProps {
  config?: Partial<TimerWheelConfig>;
  onRequestPayment: PaymentRequest;
  size?: number; // square size (default 260)
}

export const TimerWheelView: React.FC<TimerWheelViewProps> = ({
  config: cfg,
  onRequestPayment,
  size = 260
}) => {
  const config: TimerWheelConfig = { ...defaultConfig, ...(cfg || {}) };

  // geometry
  const [radius, setRadius] = useState(size / 2);
  const [centre, setCentre] = useState({ x: size / 2, y: size / 2 });

  // state
  const cumAngle = useRef(0);
  const lastAngle = useRef<number | null>(null);
  const liveDeltaMins = useRef(0);
  const [uiDelta, setUiDelta] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  // animation
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const barProgress = useRef(new Animated.Value(0)).current; // 0..1
  const snapIndex = useRef(0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    const h = e.nativeEvent.layout.height;
    setRadius(w / 2);
    setCentre({ x: w / 2, y: h / 2 });
  }

  function vecToAngle(x: number, y: number): number {
    const dx = x - centre.x;
    const dy = y - centre.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  function applyDelta(delta: number) {
    // wrap
    let adjustedDelta = delta;
    if (adjustedDelta > 180) adjustedDelta -= 360;
    if (adjustedDelta < -180) adjustedDelta += 360;

    const tentativeCumAngle = cumAngle.current + adjustedDelta;
    const steps = tentativeCumAngle / config.snapDegree;
    let mins = Math.round(steps) * config.minuteStep;

    // clamp mins if needed
    if (config.maxMinutes > 0) {
      if (mins > config.maxMinutes) mins = config.maxMinutes;
      if (mins < -config.maxMinutes) mins = -config.maxMinutes;
    }
    if (!config.allowsNegative && mins < 0) mins = 0;

    // bound logic: if we're at a bound and pushing further, discard
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

    // commit delta
    cumAngle.current += adjustedDelta;
    wheelRotation.setValue(cumAngle.current);

    // tick on notch crossings (and not at bounds)
    const newSnap = Math.round(cumAngle.current / config.snapDegree);
    const atAnyBound =
      (config.maxMinutes > 0 && (mins === config.maxMinutes || mins === -config.maxMinutes)) ||
      (!config.allowsNegative && mins === 0);

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

    // snap-back anim
    Animated.spring(wheelRotation, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6
    }).start();

    // 2s bar
    barProgress.setValue(1);
    Animated.timing(barProgress, {
      toValue: 0,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: false
    }).start();

    // after bar, fire callback
    const cost = Number((Math.abs(minutes) * config.costPerMinute).toFixed(2));
    setTimeout(() => {
      onRequestPayment(minutes, cost, (ok) => {
        if (ok) celebrate();
        else resetState();
      });
    }, 2000);

    // reset maths (but leave overlay until celebration/reset)
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

  // gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_evt: GestureResponderEvent, gs: PanResponderGestureState) => {
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

  return (
    <View style={styles.root} onLayout={onLayout} {...panResponder.panHandlers}>
      <Animated.View style={[styles.ring, ringTransform]} />
      <View style={styles.innerDisc} />
      <View style={styles.innerOutline} />

      <Animated.View style={[styles.overlayWrap, { opacity: overlayOpacity }]}>
        {showOverlay && uiDelta !== 0 ? (
          <>
            <Text style={{ fontSize: 24, fontWeight: "700" }}>
              {uiDelta > 0 ? `+${uiDelta} m` : `${uiDelta} m`}
            </Text>
            <Text style={{ fontSize: 16, opacity: 0.8 }}>
              {(uiDelta >= 0 ? "+" : "–")}${Math.abs(uiDelta * config.costPerMinute).toFixed(2)}
            </Text>
            <View style={styles.capsuleTrack}>
              <Animated.View style={[styles.capsuleFill, { width: barWidth }]} />
            </View>
          </>
        ) : (
          <Text style={styles.resetIcon}>↻</Text>
        )}
      </Animated.View>
    </View>
  );
};
