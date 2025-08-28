import React from 'react';

type CountdownListener = (remainingSeconds: number) => void;
/** Publishes remaining seconds once a second. */
declare class CountdownTimer {
    private remainingInternal;
    private intervalId;
    private listeners;
    /** Remaining time in seconds (read-only) */
    get remaining(): number;
    /** - Parameter start: initial value in seconds. */
    constructor(start: number);
    /** Start the downward count. */
    startCountdown(): void;
    /** Extend (or shorten) the timer. Accepts negative seconds. */
    extend(bySeconds: number): void;
    /** Subscribe to remaining changes (emits immediately). */
    subscribe(listener: CountdownListener): () => void;
    /** Stop and dispose. */
    dispose(): void;
    private emit;
}

type VMListener = (remainingSeconds: number) => void;
/** Glue between a CountdownTimer and UI. */
declare class TimerViewModel {
    private timer;
    private remainingSecondsInternal;
    private unsub?;
    /** Remaining seconds (read-only) */
    get remainingSeconds(): number;
    /** Init (defaults to 30 minutes) */
    constructor(startMinutes?: number);
    /** Add (or subtract) minutes. Accepts negatives. */
    extend(minutes: number): void;
    /** MM:SS string suitable for a monospaced label. */
    get timeString(): string;
    /** Subscribe to changes. Emits immediately. */
    subscribe(listener: VMListener): () => void;
    dispose(): void;
}

interface TimerWheelConfig {
    minuteStep: number;
    snapDegree: number;
    costPerMinute: number;
    allowsNegative: boolean;
    maxMinutes: number;
    ringLineWidth: number;
    ringGradient: string[];
    overlayBarWidth: number;
    overlayBarHeight: number;
    tickSoundEnabled: boolean;
    hapticSharpness: number;
    hapticIntensity: number;
    shouldPlaySuccessHaptic: boolean;
}
declare const defaultConfig: TimerWheelConfig;

type PaymentRequest = (minutes: number, cost: number, completion: (ok: boolean) => void) => void;
interface TimerWheelViewProps {
    config?: Partial<TimerWheelConfig>;
    onRequestPayment: PaymentRequest;
    size?: number;
}
declare const TimerWheelView: React.FC<TimerWheelViewProps>;

interface WheelTimerProps {
    startMinutes?: number;
    wheelConfig?: Partial<TimerWheelConfig>;
    onRequestPayment: PaymentRequest;
    size?: number;
}
declare const WheelTimer: React.FC<WheelTimerProps>;

export { type CountdownListener, CountdownTimer, type PaymentRequest, TimerViewModel, type TimerWheelConfig, TimerWheelView, type TimerWheelViewProps, type VMListener, WheelTimer, type WheelTimerProps, defaultConfig };
