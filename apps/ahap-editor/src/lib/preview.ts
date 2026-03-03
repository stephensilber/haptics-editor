import { WebHaptics } from "web-haptics";
import type { Vibration } from "web-haptics";
import type { AhapEvent } from "./types";

let instance: WebHaptics | null = null;

function getInstance(debug: boolean): WebHaptics {
  if (!instance) {
    instance = new WebHaptics({ debug });
  }
  instance.setDebug(debug);
  return instance;
}

export function eventsToVibrations(events: AhapEvent[]): Vibration[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return [];

  return sorted.map((event, i) => {
    const prev = sorted[i - 1];
    const prevEnd = prev
      ? prev.time + (prev.type === "continuous" ? prev.duration : 0.03)
      : 0;
    const delay = Math.max(0, event.time - prevEnd);
    const durationSec =
      event.type === "transient"
        ? Math.max(0.01, 0.03 * event.intensity)
        : event.duration;

    return {
      ...(delay > 0 && { delay: Math.round(delay * 1000) }),
      duration: Math.round(durationSec * 1000),
      intensity: event.intensity,
    };
  });
}

export function previewEvents(
  events: AhapEvent[],
  debug: boolean,
): {
  stop: () => void;
  duration: number;
} {
  const haptics = getInstance(debug);
  const vibrations = eventsToVibrations(events);
  const totalDuration = events.reduce(
    (max, e) =>
      Math.max(max, e.time + (e.type === "continuous" ? e.duration : 0.03)),
    0,
  );

  if (vibrations.length === 0) {
    return { stop: () => {}, duration: 0 };
  }

  haptics.trigger(vibrations);

  return {
    stop: () => haptics.cancel(),
    duration: totalDuration,
  };
}

export function triggerFeedback(debug: boolean): void {
  getInstance(debug).trigger();
}
