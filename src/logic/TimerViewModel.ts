import { CountdownTimer } from "./CountdownTimer";

export type VMListener = (remainingSeconds: number) => void;

/** Glue between a CountdownTimer and UI. */
export class TimerViewModel {
  private timer: CountdownTimer;
  private remainingSecondsInternal: number;
  private unsub?: () => void;

  /** Remaining seconds (read-only) */
  get remainingSeconds(): number {
    return this.remainingSecondsInternal;
  }

  /** Init (defaults to 30 minutes) */
  constructor(startMinutes: number = 30) {
    const secs = Math.max(0, Math.floor(startMinutes * 60));
    this.timer = new CountdownTimer(secs);
    this.remainingSecondsInternal = secs;
    this.unsub = this.timer.subscribe((s) => (this.remainingSecondsInternal = s));
  }

  /** Add (or subtract) minutes. Accepts negatives. */
  public extend(minutes: number) {
    this.timer.extend(minutes * 60);
  }

  /** MM:SS string suitable for a monospaced label. */
  public get timeString(): string {
    const m = Math.floor(this.remainingSecondsInternal / 60);
    const s = this.remainingSecondsInternal % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /** Subscribe to changes. Emits immediately. */
  public subscribe(listener: VMListener): () => void {
    listener(this.remainingSecondsInternal);
    return this.timer.subscribe((s) => listener((this.remainingSecondsInternal = s)));
  }

  public dispose() {
    this.unsub?.();
    this.timer.dispose();
  }
}
