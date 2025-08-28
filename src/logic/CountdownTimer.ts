export type CountdownListener = (remainingSeconds: number) => void;

/** Publishes remaining seconds once a second. */
export class CountdownTimer {
  private remainingInternal: number;
  private intervalId: any = null;
  private listeners = new Set<CountdownListener>();

  /** Remaining time in seconds (read-only) */
  get remaining(): number {
    return this.remainingInternal;
  }

  /** - Parameter start: initial value in seconds. */
  constructor(start: number) {
    this.remainingInternal = Math.max(0, Math.floor(start || 0));
    this.startCountdown();
  }

  /** Start the downward count. */
  public startCountdown() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      if (this.remainingInternal > 0) {
        this.remainingInternal -= 1;
        this.emit();
      }
    }, 1000);
  }

  /** Extend (or shorten) the timer. Accepts negative seconds. */
  public extend(bySeconds: number) {
    this.remainingInternal = Math.max(0, this.remainingInternal + Math.floor(bySeconds));
    this.emit();
  }

  /** Subscribe to remaining changes (emits immediately). */
  public subscribe(listener: CountdownListener): () => void {
    this.listeners.add(listener);
    listener(this.remainingInternal);
    return () => this.listeners.delete(listener);
  }

  /** Stop and dispose. */
  public dispose() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.listeners.clear();
  }

  private emit() {
    for (const l of this.listeners) l(this.remainingInternal);
  }
}
