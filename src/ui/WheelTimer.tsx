import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { TimerWheelView, PaymentRequest } from "./TimerWheelView";
import { TimerWheelConfig, defaultConfig } from "./TimerWheelConfig";
import { TimerViewModel } from "../logic/TimerViewModel";
import { successHaptic } from "./haptics";
import { playSuccessSound } from "./sound";

export interface WheelTimerProps {
  startMinutes?: number;
  wheelConfig?: Partial<TimerWheelConfig>;
  onRequestPayment: PaymentRequest;
  size?: number;
}

export const WheelTimer: React.FC<WheelTimerProps> = ({
  startMinutes = 30,
  wheelConfig,
  onRequestPayment,
  size = 260
}) => {
  const config: TimerWheelConfig = { ...defaultConfig, ...(wheelConfig || {}) };

  const vmRef = useRef<TimerViewModel | undefined>(undefined);
  if (!vmRef.current) vmRef.current = new TimerViewModel(startMinutes);

  const [remaining, setRemaining] = useState(vmRef.current.remainingSeconds);
  const [timeStr, setTimeStr] = useState(vmRef.current.timeString);

  useEffect(() => {
    const unsub = vmRef.current!.subscribe((secs) => {
      setRemaining(secs);
      setTimeStr(vmRef.current!.timeString);
    });
    return () => unsub();
  }, []);

  // neon flash
  const flash = useRef(new Animated.Value(0)).current;
  const flashDuration = 600;

  // confetti-lite: a few animated squares
  const [confettiSeed, setConfettiSeed] = useState(0);

  function startCelebration(addMinutes: number) {
    // flash
    flash.setValue(0);
    Animated.timing(flash, {
      toValue: 1,
      duration: flashDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start(() => flash.setValue(0));

    // haptic + (optional) sound
    if (config.shouldPlaySuccessHaptic) successHaptic();
    playSuccessSound();

    // confetti
    setConfettiSeed((s) => s + 1);

    // update timer after flash
    setTimeout(() => {
      vmRef.current?.extend(addMinutes);
    }, flashDuration);
  }

  const onWheelRequest: PaymentRequest = (mins, cost, completion) => {
    onRequestPayment(mins, cost, (ok) => {
      completion(ok);
      if (ok) {
        // kick off celebration ~2s after the wheel’s bar completes (Wheel already waits 2s)
        setTimeout(() => startCelebration(mins), 0);
      }
    });
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
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

  return (
    <View style={s.container}>
      <Text style={s.title}>TIME REMAINING</Text>
      <View>
        <Text style={s.timer}>{timeStr}</Text>
        <Animated.View pointerEvents="none" style={[s.flashOverlay, flashStyle]} />
      </View>
      <Text style={s.hint}>Spin the dial to extend your booking</Text>

      {/* confetti-lite */}
      <ConfettiLite seed={confettiSeed} />

      <View style={s.row}>
        <TimerWheelView size={size} config={config} onRequestPayment={onWheelRequest} />
      </View>
    </View>
  );
};

/** tiny confetti with Animated Views, zero native deps */
const ConfettiLite: React.FC<{ seed: number }> = ({ seed }) => {
  const pieces = Array.from({ length: 40 }, (_, i) => i + seed);
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%" }}>
      {pieces.map((k) => (
        <ConfettiPiece key={k} />
      ))}
    </View>
  );
};

const ConfettiPiece: React.FC = () => {
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

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        width: size,
        height: size,
        backgroundColor: bg,
        transform: [{ translateX: x }, { translateY: y }, { rotate }]
      }}
    />
  );
};
