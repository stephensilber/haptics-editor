import type { AhapEvent } from "./types";

interface AhapEventParameter {
  ParameterID: string;
  ParameterValue: number;
}

interface AhapEventEntry {
  Time: number;
  EventType: string;
  EventDuration?: number;
  EventParameters?: AhapEventParameter[];
}

interface AhapPatternEntry {
  Event?: AhapEventEntry;
  Parameter?: unknown;
  ParameterCurve?: unknown;
}

interface AhapFile {
  Version: number;
  Metadata?: Record<string, string>;
  Pattern: AhapPatternEntry[];
}

export function eventsToAhap(
  events: AhapEvent[],
  metadata?: { name: string },
): string {
  const sorted = [...events].sort((a, b) => a.time - b.time);

  const pattern: AhapPatternEntry[] = sorted.map((event) => {
    const params: AhapEventParameter[] = [
      { ParameterID: "HapticIntensity", ParameterValue: round(event.intensity) },
      { ParameterID: "HapticSharpness", ParameterValue: round(event.sharpness) },
    ];

    const entry: AhapEventEntry = {
      Time: round(event.time),
      EventType:
        event.type === "transient" ? "HapticTransient" : "HapticContinuous",
      EventParameters: params,
    };

    if (event.type === "continuous") {
      entry.EventDuration = round(event.duration);
    }

    return { Event: entry };
  });

  const ahap: AhapFile = {
    Version: 1.0,
    Pattern: pattern,
  };

  if (metadata?.name) {
    ahap.Metadata = { Project: metadata.name };
  }

  return JSON.stringify(ahap, null, 2);
}

export function ahapToEvents(json: string): AhapEvent[] {
  const ahap: AhapFile = JSON.parse(json);
  const events: AhapEvent[] = [];
  let nextId = 1;

  for (const entry of ahap.Pattern) {
    if (!entry.Event) continue;

    const evt = entry.Event;
    if (
      evt.EventType !== "HapticTransient" &&
      evt.EventType !== "HapticContinuous"
    ) {
      continue;
    }

    const params = evt.EventParameters ?? [];
    const intensity =
      params.find((p) => p.ParameterID === "HapticIntensity")?.ParameterValue ??
      0.5;
    const sharpness =
      params.find((p) => p.ParameterID === "HapticSharpness")?.ParameterValue ??
      0.5;

    events.push({
      id: String(nextId++),
      type: evt.EventType === "HapticTransient" ? "transient" : "continuous",
      time: evt.Time ?? 0,
      duration:
        evt.EventType === "HapticContinuous" ? (evt.EventDuration ?? 0.5) : 0.03,
      intensity: clamp(intensity),
      sharpness: clamp(sharpness),
    });
  }

  return events;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
