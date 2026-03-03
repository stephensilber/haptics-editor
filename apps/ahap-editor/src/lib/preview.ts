import type { AhapEvent } from "./types";

const TOGGLE_MIN = 16;
const TOGGLE_MAX = 184;
const PWM_CYCLE = 20;

let audioCtx: AudioContext | null = null;
let audioFilter: BiquadFilterNode | null = null;
let audioGain: GainNode | null = null;
let audioBuffer: AudioBuffer | null = null;

async function ensureAudio(): Promise<boolean> {
  if (typeof AudioContext === "undefined") return false;

  if (!audioCtx) {
    audioCtx = new AudioContext();

    audioFilter = audioCtx.createBiquadFilter();
    audioFilter.type = "bandpass";
    audioFilter.frequency.value = 4000;
    audioFilter.Q.value = 8;

    audioGain = audioCtx.createGain();
    audioFilter.connect(audioGain);
    audioGain.connect(audioCtx.destination);

    const duration = 0.004;
    audioBuffer = audioCtx.createBuffer(
      1,
      audioCtx.sampleRate * duration,
      audioCtx.sampleRate,
    );
  }

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  return true;
}

function playClick(intensity: number, sharpness: number): void {
  if (!audioCtx || !audioFilter || !audioGain || !audioBuffer) return;

  const data = audioBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 25);
  }

  audioGain.gain.value = 0.5 * intensity;

  const baseFreq = 2000 + sharpness * 3000;
  const jitter = 1 + (Math.random() - 0.5) * 0.2;
  audioFilter.frequency.value = baseFreq * jitter;
  audioFilter.Q.value = 4 + sharpness * 12;

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioFilter);
  source.onended = () => source.disconnect();
  source.start();
}

function modulateVibration(duration: number, intensity: number): number[] {
  if (intensity >= 1) return [duration];
  if (intensity <= 0) return [];

  const onTime = Math.max(1, Math.round(PWM_CYCLE * intensity));
  const offTime = PWM_CYCLE - onTime;
  const result: number[] = [];

  let remaining = duration;
  while (remaining >= PWM_CYCLE) {
    result.push(onTime);
    result.push(offTime);
    remaining -= PWM_CYCLE;
  }
  if (remaining > 0) {
    const remOn = Math.max(1, Math.round(remaining * intensity));
    result.push(remOn);
    const remOff = remaining - remOn;
    if (remOff > 0) result.push(remOff);
  }

  return result;
}

export async function previewEvents(events: AhapEvent[]): Promise<{
  stop: () => void;
  duration: number;
}> {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const hasAudio = await ensureAudio();
  const hasVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  let rafId: number | null = null;
  const timeouts: number[] = [];

  const totalDuration = sorted.reduce(
    (max, e) =>
      Math.max(max, e.time + (e.type === "continuous" ? e.duration : 0.03)),
    0,
  );

  if (!hasAudio && !hasVibrate) {
    return { stop: () => {}, duration: totalDuration };
  }

  // Build scheduled phases from events
  interface Phase {
    start: number; // ms
    end: number; // ms
    intensity: number;
    sharpness: number;
    type: "transient" | "continuous";
  }

  const phases: Phase[] = sorted.map((e) => ({
    start: e.time * 1000,
    end: (e.time + (e.type === "continuous" ? e.duration : 0.03)) * 1000,
    intensity: e.intensity,
    sharpness: e.sharpness,
    type: e.type,
  }));

  // Vibration API: schedule each event
  if (hasVibrate) {
    for (const event of sorted) {
      const startMs = event.time * 1000;
      const durationMs =
        event.type === "transient"
          ? Math.max(10, Math.round(30 * event.intensity))
          : Math.round(event.duration * 1000);
      const pattern = modulateVibration(durationMs, event.intensity);
      timeouts.push(
        window.setTimeout(() => navigator.vibrate(pattern), startMs),
      );
    }
  }

  // Audio: RAF loop that fires clicks at appropriate intervals
  if (hasAudio) {
    let startTime = 0;
    const lastClickTime = new Map<number, number>();

    const loop = (time: number) => {
      if (startTime === 0) startTime = time;
      const elapsed = time - startTime;

      if (elapsed >= totalDuration * 1000) {
        rafId = null;
        return;
      }

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]!;
        if (elapsed < phase.start || elapsed >= phase.end) continue;

        const toggleInterval =
          TOGGLE_MIN + (1 - phase.intensity) * TOGGLE_MAX;
        const last = lastClickTime.get(i) ?? -1;

        if (last === -1 || time - last >= toggleInterval) {
          playClick(phase.intensity, phase.sharpness);
          lastClickTime.set(i, time);
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
  }

  return {
    stop: () => {
      timeouts.forEach(clearTimeout);
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      if (hasVibrate) navigator.vibrate(0);
    },
    duration: totalDuration,
  };
}
