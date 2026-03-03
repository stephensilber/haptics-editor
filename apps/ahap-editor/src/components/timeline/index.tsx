import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import type { AhapEvent } from "../../lib/types";
import { previewEvents } from "../../lib/preview";
import styles from "./styles.module.scss";

let nextId = 100;
const genId = () => String(nextId++);

const SNAP_INTERVAL = 0.05;
const snap = (v: number) => Math.round(v / SNAP_INTERVAL) * SNAP_INTERVAL;
const DELETE_THRESHOLD = 20;
const DEFAULT_TIMELINE_DURATION = 2;
const TRANSIENT_VISUAL_WIDTH = 0.03;

export type TimelineAction =
  | { type: "ADD_EVENT"; time: number; eventType: "transient" | "continuous" }
  | { type: "SELECT_EVENT"; id: string | null }
  | { type: "MOVE_EVENT"; id: string; time: number }
  | { type: "SET_DURATION"; id: string; duration: number }
  | { type: "RESIZE_LEFT"; id: string; time: number }
  | { type: "REMOVE_EVENT"; id: string }
  | { type: "SET_INTENSITY"; id: string; intensity: number }
  | { type: "SET_SHARPNESS"; id: string; sharpness: number }
  | { type: "SET_EVENT_TYPE"; id: string; eventType: "transient" | "continuous" }
  | { type: "SET_TIME"; id: string; time: number }
  | { type: "LOAD_EVENTS"; events: AhapEvent[] };

export interface EditorState {
  events: AhapEvent[];
  selectedId: string | null;
}

const DEFAULT_CONTINUOUS_DURATION = 0.3;

export function createInitialState(): EditorState {
  return {
    events: [
      {
        id: genId(),
        type: "transient",
        time: 0,
        duration: TRANSIENT_VISUAL_WIDTH,
        intensity: 0.8,
        sharpness: 0.5,
      },
      {
        id: genId(),
        type: "continuous",
        time: 0.3,
        duration: 0.5,
        intensity: 0.6,
        sharpness: 0.3,
      },
    ],
    selectedId: null,
  };
}

export { genId };

export function reducer(state: EditorState, action: TimelineAction): EditorState {
  switch (action.type) {
    case "ADD_EVENT": {
      const snapped = snap(Math.max(0, action.time));
      const duration =
        action.eventType === "transient"
          ? TRANSIENT_VISUAL_WIDTH
          : DEFAULT_CONTINUOUS_DURATION;
      const newEvent: AhapEvent = {
        id: genId(),
        type: action.eventType,
        time: snapped,
        duration,
        intensity: 0.5,
        sharpness: 0.5,
      };
      return {
        ...state,
        events: [...state.events, newEvent],
        selectedId: newEvent.id,
      };
    }

    case "SELECT_EVENT":
      return { ...state, selectedId: action.id };

    case "MOVE_EVENT": {
      const snapped = snap(Math.max(0, action.time));
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, time: snapped } : e,
        ),
      };
    }

    case "SET_DURATION": {
      const dur = Math.max(0.01, action.duration);
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, duration: dur } : e,
        ),
      };
    }

    case "RESIZE_LEFT": {
      const event = state.events.find((e) => e.id === action.id);
      if (!event || event.type === "transient") return state;
      const newTime = snap(Math.max(0, Math.min(event.time + event.duration - 0.01, action.time)));
      const newDur = event.time + event.duration - newTime;
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, time: newTime, duration: newDur } : e,
        ),
      };
    }

    case "REMOVE_EVENT":
      return {
        ...state,
        events: state.events.filter((e) => e.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };

    case "SET_INTENSITY":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? { ...e, intensity: Math.max(0, Math.min(1, action.intensity)) }
            : e,
        ),
      };

    case "SET_SHARPNESS":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? { ...e, sharpness: Math.max(0, Math.min(1, action.sharpness)) }
            : e,
        ),
      };

    case "SET_EVENT_TYPE": {
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? {
                ...e,
                type: action.eventType,
                duration:
                  action.eventType === "transient"
                    ? TRANSIENT_VISUAL_WIDTH
                    : DEFAULT_CONTINUOUS_DURATION,
              }
            : e,
        ),
      };
    }

    case "SET_TIME": {
      const snapped = snap(Math.max(0, action.time));
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, time: snapped } : e,
        ),
      };
    }

    case "LOAD_EVENTS":
      return { events: action.events, selectedId: null };

    default:
      return state;
  }
}

interface TimelineProps {
  state: EditorState;
  dispatch: React.Dispatch<TimelineAction>;
  addMode: "transient" | "continuous";
}

export interface TimelineHandle {
  play: () => void;
  playing: boolean;
  totalDuration: number;
}

export const Timeline = forwardRef<TimelineHandle, TimelineProps>(function Timeline(
  { state, dispatch, addMode },
  ref,
) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteIdRef = useRef<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [activeTapIds, setActiveTapIds] = useState<Set<string>>(new Set());
  const [playCount, setPlayCount] = useState(0);
  const timeoutsRef = useRef<number[]>([]);
  const stopRef = useRef<(() => void) | null>(null);

  const maxTime = state.events.reduce(
    (max, e) => Math.max(max, e.time + (e.type === "continuous" ? e.duration : TRANSIENT_VISUAL_WIDTH)),
    0,
  );
  const timelineDuration = Math.max(DEFAULT_TIMELINE_DURATION, Math.ceil(maxTime * 2) / 2 + 0.5);

  const gridlines: number[] = [];
  for (let t = SNAP_INTERVAL; t < timelineDuration; t += SNAP_INTERVAL) {
    gridlines.push(Math.round(t * 1000) / 1000);
  }

  const labels: number[] = [];
  const labelInterval = timelineDuration <= 4 ? 0.5 : 1;
  for (let t = 0; t <= timelineDuration; t += labelInterval) {
    labels.push(Math.round(t * 10) / 10);
  }

  const totalDuration = state.events.length
    ? Math.max(
        ...state.events.map((e) =>
          e.time + (e.type === "continuous" ? e.duration : TRANSIENT_VISUAL_WIDTH),
        ),
      )
    : 0;

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const time = ((e.clientX - rect.left) / rect.width) * timelineDuration;
      dispatch({ type: "ADD_EVENT", time, eventType: addMode });
    },
    [dispatch, addMode, timelineDuration],
  );

  const handleDragStart = useCallback(
    (e: React.PointerEvent, eventId: string) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "SELECT_EVENT", id: eventId });

      const container = timelineRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const cursorTime =
        ((e.clientX - rect.left) / rect.width) * timelineDuration;
      const event = state.events.find((ev) => ev.id === eventId);
      const offsetTime = event ? cursorTime - event.time : 0;
      let currentTime = event?.time ?? 0;

      const initialScreenX =
        rect.left + ((event?.time ?? 0) / timelineDuration) * rect.width;
      const initialScreenY = rect.top + rect.height / 2;
      const grabOffsetX = e.clientX - initialScreenX;
      const grabOffsetY = e.clientY - initialScreenY;

      const onMove = (me: PointerEvent) => {
        const distLeft = rect.left - me.clientX;
        const distRight = me.clientX - rect.right;
        const distTop = rect.top - me.clientY;
        const distBottom = me.clientY - rect.bottom;
        const maxDist = Math.max(distLeft, distRight, distTop, distBottom);

        if (maxDist > DELETE_THRESHOLD) {
          setPendingDeleteId(eventId);
          pendingDeleteIdRef.current = eventId;
          const homeX =
            rect.left + (currentTime / timelineDuration) * rect.width;
          const homeY = rect.top + rect.height / 2;
          setDragOffset({
            x: me.clientX - grabOffsetX - homeX,
            y: me.clientY - grabOffsetY - homeY,
          });
        } else {
          setPendingDeleteId(null);
          pendingDeleteIdRef.current = null;
          setDragOffset({ x: 0, y: 0 });
          const time =
            ((me.clientX - rect.left) / rect.width) * timelineDuration -
            offsetTime;
          dispatch({ type: "MOVE_EVENT", id: eventId, time });
          currentTime = snap(Math.max(0, time));
        }
      };

      const onUp = () => {
        if (pendingDeleteIdRef.current === eventId) {
          dispatch({ type: "REMOVE_EVENT", id: eventId });
        }
        setPendingDeleteId(null);
        pendingDeleteIdRef.current = null;
        setDragOffset({ x: 0, y: 0 });
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [state.events, dispatch, timelineDuration],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, eventId: string) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "SELECT_EVENT", id: eventId });

      const container = timelineRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const onMove = (me: PointerEvent) => {
        const event = state.events.find((ev) => ev.id === eventId);
        if (!event) return;
        const timeAtCursor =
          ((me.clientX - rect.left) / rect.width) * timelineDuration;
        const newDuration = snap(Math.max(0.01, timeAtCursor - event.time));
        dispatch({ type: "SET_DURATION", id: eventId, duration: newDuration });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [state.events, dispatch, timelineDuration],
  );

  const handleResizeLeftStart = useCallback(
    (e: React.PointerEvent, eventId: string) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "SELECT_EVENT", id: eventId });

      const container = timelineRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const onMove = (me: PointerEvent) => {
        const timeAtCursor =
          ((me.clientX - rect.left) / rect.width) * timelineDuration;
        dispatch({ type: "RESIZE_LEFT", id: eventId, time: timeAtCursor });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [dispatch, timelineDuration],
  );

  const handleIntensityDragStart = useCallback(
    (e: React.PointerEvent, eventId: string, edge: "top" | "bottom") => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "SELECT_EVENT", id: eventId });

      const container = timelineRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const onMove = (me: PointerEvent) => {
        const distFromEdge =
          edge === "top"
            ? (me.clientY - rect.top) / rect.height
            : (rect.bottom - me.clientY) / rect.height;
        const intensity =
          Math.round(Math.max(0, Math.min(1, 1 - distFromEdge * 2)) * 100) /
          100;
        dispatch({ type: "SET_INTENSITY", id: eventId, intensity });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [dispatch],
  );

  const handlePlay = useCallback(async () => {
    if (state.events.length === 0) return;

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    stopRef.current?.();

    const immediate = new Set(
      state.events.filter((e) => e.time === 0).map((e) => e.id),
    );
    setActiveTapIds(immediate);

    const { stop } = await previewEvents(state.events);
    stopRef.current = stop;
    setPlaying(true);
    setPlayCount((c) => c + 1);

    for (const event of state.events) {
      const startMs = event.time * 1000;
      const endMs =
        startMs +
        (event.type === "continuous" ? event.duration * 1000 : 30);

      if (startMs > 0) {
        timeoutsRef.current.push(
          window.setTimeout(
            () => setActiveTapIds((prev) => new Set(prev).add(event.id)),
            startMs,
          ),
        );
      }
      timeoutsRef.current.push(
        window.setTimeout(() => {
          setActiveTapIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
        }, endMs),
      );
    }

    const end = totalDuration * 1000;
    timeoutsRef.current.push(
      window.setTimeout(() => {
        setPlaying(false);
        setActiveTapIds(new Set());
      }, end),
    );
  }, [state.events, totalDuration]);

  useImperativeHandle(
    ref,
    () => ({
      play: handlePlay,
      playing,
      totalDuration,
    }),
    [handlePlay, playing, totalDuration],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        e.preventDefault();
        dispatch({ type: "REMOVE_EVENT", id: state.selectedId });
      }
      if (e.key === " " && state.events.length > 0) {
        e.preventDefault();
        handlePlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedId, state.events.length, dispatch, handlePlay]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      stopRef.current?.();
    };
  }, []);

  const getSharpnessColor = (sharpness: number) => {
    const hue = 220 - sharpness * 180;
    return `hsl(${hue}, 70%, 55%)`;
  };

  return (
    <div className={styles.timelineContainer}>
      <div
        className={styles.timeline}
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        {gridlines.map((t) => (
          <div
            key={t}
            className={styles.gridline}
            data-minor={Math.round(t * 10) % 5 !== 0}
            style={{ left: `${(t / timelineDuration) * 100}%` }}
          />
        ))}

        <AnimatePresence>
          {state.events.map((event) => {
            const isTransient = event.type === "transient";
            const visualDuration = isTransient
              ? TRANSIENT_VISUAL_WIDTH
              : event.duration;
            const widthPercent = (visualDuration / timelineDuration) * 100;
            const leftPercent = (event.time / timelineDuration) * 100;
            const inset = `calc(${1 - event.intensity} * (50% - 10px))`;
            const isDeleting = pendingDeleteId === event.id;
            const color = getSharpnessColor(event.sharpness);

            return (
              <motion.div
                key={event.id}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  width: isTransient ? 16 : `${widthPercent}%`,
                  minWidth: isTransient ? 16 : 8,
                  top: 0,
                  bottom: 0,
                  x: isDeleting ? dragOffset.x : 0,
                  y: isDeleting ? dragOffset.y : 0,
                  zIndex: isDeleting ? 9999 : undefined,
                  pointerEvents: "none",
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x: isDeleting ? dragOffset.x : 0,
                  y: isDeleting ? dragOffset.y : 0,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  x: { type: "spring", stiffness: 300, damping: 25 },
                  y: { type: "spring", stiffness: 300, damping: 25 },
                }}
              >
                <div
                  className={isDeleting ? styles.wobble : undefined}
                  style={{ position: "absolute", inset: 0 }}
                >
                  {isTransient ? (
                    <div
                      className={styles.transientEvent}
                      data-selected={event.id === state.selectedId}
                      data-playing={activeTapIds.has(event.id)}
                      style={{
                        top: inset,
                        bottom: inset,
                        pointerEvents: "auto",
                        "--event-color": color,
                      } as React.CSSProperties}
                      onPointerDown={(e) => handleDragStart(e, event.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "SELECT_EVENT", id: event.id });
                      }}
                    >
                      <div
                        className={styles.intensityHandleTop}
                        onPointerDown={(e) =>
                          handleIntensityDragStart(e, event.id, "top")
                        }
                      />
                      <div
                        className={styles.intensityHandleBottom}
                        onPointerDown={(e) =>
                          handleIntensityDragStart(e, event.id, "bottom")
                        }
                      />
                    </div>
                  ) : (
                    <motion.div
                      className={styles.continuousEvent}
                      data-selected={event.id === state.selectedId}
                      data-playing={activeTapIds.has(event.id)}
                      style={{
                        left: 0,
                        right: 0,
                        top: inset,
                        bottom: inset,
                        pointerEvents: "auto",
                        "--event-color": color,
                      } as React.CSSProperties}
                      onPointerDown={(e) => handleDragStart(e, event.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "SELECT_EVENT", id: event.id });
                      }}
                    >
                      <div
                        className={styles.resizeHandleLeft}
                        onPointerDown={(e) =>
                          handleResizeLeftStart(e, event.id)
                        }
                      />
                      <div
                        className={styles.resizeHandle}
                        onPointerDown={(e) => handleResizeStart(e, event.id)}
                      />
                      <div
                        className={styles.intensityHandleTop}
                        onPointerDown={(e) =>
                          handleIntensityDragStart(e, event.id, "top")
                        }
                      />
                      <div
                        className={styles.intensityHandleBottom}
                        onPointerDown={(e) =>
                          handleIntensityDragStart(e, event.id, "bottom")
                        }
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {playing && totalDuration > 0 && (
          <motion.div
            key={`playhead-${playCount}`}
            className={styles.playhead}
            initial={{ left: 0 }}
            animate={{
              left: `${(totalDuration / timelineDuration) * 100}%`,
            }}
            transition={{ duration: totalDuration, ease: "linear" }}
          />
        )}

        {state.events.length === 0 && (
          <div className={styles.emptyState}>
            <span>Tap to add a haptic event</span>
          </div>
        )}
      </div>

      <div className={styles.timelineLabels}>
        {labels.map((t) => (
          <span key={t}>{t.toFixed(1)}s</span>
        ))}
      </div>
    </div>
  );
});
