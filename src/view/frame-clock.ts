export const FRAME_INTERVAL_MS = 1000 / 60;

const FRAME_TOLERANCE_MS = 1;
const MAX_ELAPSED_MS = 100;

export interface FrameDecision {
  readonly render: boolean;
  readonly steps: number;
}

export class FrameClock {
  speed = 1;
  paused = true;
  private nextTarget: number | null = null;
  private lastRender = 0;
  private pendingSimSeconds = 0;

  constructor(private readonly stepSeconds: number) {}

  tick(now: number): FrameDecision {
    if (this.nextTarget === null) {
      this.nextTarget = now + FRAME_INTERVAL_MS;
      this.lastRender = now;
      return { render: true, steps: 0 };
    }
    if (now < this.nextTarget - FRAME_TOLERANCE_MS) {
      return { render: false, steps: 0 };
    }
    this.nextTarget += FRAME_INTERVAL_MS;
    if (this.nextTarget < now) {
      this.nextTarget = now + FRAME_INTERVAL_MS;
    }
    const elapsed = Math.min(now - this.lastRender, MAX_ELAPSED_MS);
    this.lastRender = now;
    if (this.paused) {
      return { render: true, steps: 0 };
    }
    this.pendingSimSeconds += (this.speed * elapsed) / 1000;
    const steps = Math.floor(this.pendingSimSeconds / this.stepSeconds);
    this.pendingSimSeconds -= steps * this.stepSeconds;
    return { render: true, steps };
  }
}
