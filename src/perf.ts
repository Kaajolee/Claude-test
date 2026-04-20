import * as THREE from 'three';

// Adjusts the renderer's pixel ratio based on a rolling average of frame
// times. If we sustain worse than 30fps, drop DPR one notch. If we stay
// comfortably above 60fps, step back up (never past the device maximum).
export class AdaptiveDPR {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly min: number;
  private readonly max: number;
  private readonly sampleFrames: number;
  private totalDt = 0;
  private frameCount = 0;
  private dpr: number;

  constructor(
    renderer: THREE.WebGLRenderer,
    opts: { min?: number; max?: number; sampleFrames?: number } = {}
  ) {
    this.renderer = renderer;
    this.min = opts.min ?? 0.75;
    this.max = opts.max ?? Math.min(window.devicePixelRatio, 2);
    this.sampleFrames = opts.sampleFrames ?? 120;
    this.dpr = this.max;
    renderer.setPixelRatio(this.dpr);
  }

  sample(dt: number): void {
    this.totalDt += dt;
    this.frameCount++;
    if (this.frameCount < this.sampleFrames) return;

    const avgMs = (this.totalDt / this.frameCount) * 1000;
    this.totalDt = 0;
    this.frameCount = 0;

    let next = this.dpr;
    if (avgMs > 33 && this.dpr > this.min) {
      next = Math.max(this.min, this.dpr - 0.25);
    } else if (avgMs < 16 && this.dpr < this.max) {
      next = Math.min(this.max, this.dpr + 0.25);
    }

    if (next !== this.dpr) {
      this.dpr = next;
      this.renderer.setPixelRatio(next);
    }
  }

  reset(): void {
    this.totalDt = 0;
    this.frameCount = 0;
  }

  get current(): number {
    return this.dpr;
  }
}
