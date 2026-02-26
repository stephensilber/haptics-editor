import { defaultPatterns } from "./patterns";
import type { HapticInput, TriggerOptions, WebHapticsOptions } from "./types";

let instanceCounter = 0;

export class WebHaptics {
  private hapticLabel: HTMLLabelElement | null = null;
  private domInitialized = false;
  private instanceId: number;
  private debug: boolean;
  private rafId: number | null = null;
  private patternResolve: (() => void) | null = null;
  private audioCtx: AudioContext | null = null;

  constructor(options?: WebHapticsOptions) {
    this.instanceId = ++instanceCounter;
    this.debug = options?.debug ?? false;
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    );
  }

  async trigger(
    input: HapticInput = defaultPatterns.lightTap,
    options?: TriggerOptions,
  ): Promise<void> {
    const pattern = typeof input === "number" ? [input] : input;
    const intensity = Math.max(0, Math.min(1, options?.intensity ?? 1));

    for (let i = 0; i < pattern.length; i++) {
      if (!Number.isFinite(pattern[i]) || pattern[i]! < 0) {
        console.warn(
          `[web-haptics] Invalid value at index ${i}: ${pattern[i]}. Pattern values must be finite non-negative numbers.`,
        );
        return;
      }
    }

    if (WebHaptics.isSupported()) {
      navigator.vibrate(pattern);
    }

    if (!WebHaptics.isSupported() || this.debug) {
      this.ensureDOM();
      if (!this.hapticLabel) return;

      if (this.debug) {
        await this.ensureAudio();
      }

      this.stopPattern();
      await this.runPattern(pattern, intensity);
    }
  }

  cancel(): void {
    this.stopPattern();
    if (WebHaptics.isSupported()) {
      navigator.vibrate(0);
    }
  }

  destroy(): void {
    this.stopPattern();
    if (this.hapticLabel) {
      this.hapticLabel.remove();
      this.hapticLabel = null;
      this.domInitialized = false;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private stopPattern(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.patternResolve?.();
    this.patternResolve = null;
  }

  private runPattern(pattern: number[], intensity: number): Promise<void> {
    return new Promise((resolve) => {
      this.patternResolve = resolve;

      const phases: number[] = [];
      let cumulative = 0;
      for (const p of pattern) {
        cumulative += p;
        phases.push(cumulative);
      }
      const totalDuration = cumulative;

      let startTime = 0;
      let lastClickTime = 0;
      const clickInterval = 1000 / 8;

      const loop = (time: number) => {
        if (startTime === 0) startTime = time;
        const elapsed = time - startTime;

        if (elapsed >= totalDuration) {
          this.rafId = null;
          this.patternResolve = null;
          resolve();
          return;
        }

        let phaseIndex = 0;
        for (let i = 0; i < phases.length; i++) {
          if (elapsed < phases[i]!) {
            phaseIndex = i;
            break;
          }
        }

        if (phaseIndex % 2 === 0) {
          this.hapticLabel?.click();
          if (
            this.debug &&
            this.audioCtx &&
            time - lastClickTime >= clickInterval
          ) {
            this.playClick(intensity);
            lastClickTime = time;
          }
        }

        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    });
  }

  private playClick(intensity: number): void {
    if (!this.audioCtx) return;

    const duration = 0.008 * 0.5;
    const buffer = this.audioCtx.createBuffer(
      1,
      this.audioCtx.sampleRate * duration,
      this.audioCtx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (50 * 0.5));
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 4000;
    filter.Q.value = 8;

    const gain = this.audioCtx.createGain();
    gain.gain.value = 0.5 * intensity;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);
    source.start();
  }

  private async ensureAudio(): Promise<void> {
    if (!this.audioCtx && typeof AudioContext !== "undefined") {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  private ensureDOM(): void {
    if (this.domInitialized) return;
    if (typeof document === "undefined") return;

    const id = `web-haptics-${this.instanceId}`;

    const hapticLabel = document.createElement("label");
    hapticLabel.setAttribute("for", id);
    hapticLabel.style.display = "none";
    hapticLabel.textContent = "Haptic feedback";
    this.hapticLabel = hapticLabel;

    const hapticCheckbox = document.createElement("input");
    hapticCheckbox.type = "checkbox";
    hapticCheckbox.setAttribute("switch", "");
    hapticCheckbox.id = id;
    hapticCheckbox.style.display = "none";

    hapticLabel.appendChild(hapticCheckbox);
    document.body.appendChild(hapticLabel);

    this.domInitialized = true;
  }
}
