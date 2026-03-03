import type { AhapEvent } from "../../lib/types";
import type { TimelineAction } from "../timeline";
import styles from "./styles.module.scss";

interface EventInspectorProps {
  event: AhapEvent;
  dispatch: React.Dispatch<TimelineAction>;
}

export function EventInspector({ event, dispatch }: EventInspectorProps) {
  return (
    <div className={styles.inspector}>
      <div className={styles.row}>
        <div className={styles.typeToggle}>
          <button
            data-active={event.type === "transient"}
            onClick={() =>
              dispatch({
                type: "SET_EVENT_TYPE",
                id: event.id,
                eventType: "transient",
              })
            }
          >
            Transient
          </button>
          <button
            data-active={event.type === "continuous"}
            onClick={() =>
              dispatch({
                type: "SET_EVENT_TYPE",
                id: event.id,
                eventType: "continuous",
              })
            }
          >
            Continuous
          </button>
        </div>
      </div>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label>Time</label>
          <input
            type="number"
            value={round(event.time)}
            min={0}
            step={0.05}
            onChange={(e) =>
              dispatch({
                type: "SET_TIME",
                id: event.id,
                time: parseFloat(e.target.value) || 0,
              })
            }
          />
          <span className={styles.unit}>s</span>
        </div>

        {event.type === "continuous" && (
          <div className={styles.field}>
            <label>Duration</label>
            <input
              type="number"
              value={round(event.duration)}
              min={0.01}
              step={0.05}
              onChange={(e) =>
                dispatch({
                  type: "SET_DURATION",
                  id: event.id,
                  duration: parseFloat(e.target.value) || 0.01,
                })
              }
            />
            <span className={styles.unit}>s</span>
          </div>
        )}
      </div>

      <div className={styles.sliderGroup}>
        <div className={styles.slider}>
          <div className={styles.sliderHeader}>
            <label>Intensity</label>
            <span className={styles.sliderValue}>
              {round(event.intensity)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={event.intensity}
            onChange={(e) =>
              dispatch({
                type: "SET_INTENSITY",
                id: event.id,
                intensity: parseFloat(e.target.value),
              })
            }
          />
        </div>

        <div className={styles.slider}>
          <div className={styles.sliderHeader}>
            <label>Sharpness</label>
            <span className={styles.sliderValue}>
              {round(event.sharpness)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={event.sharpness}
            onChange={(e) =>
              dispatch({
                type: "SET_SHARPNESS",
                id: event.id,
                sharpness: parseFloat(e.target.value),
              })
            }
          />
        </div>
      </div>

      <button
        className={styles.deleteButton}
        onClick={() => dispatch({ type: "REMOVE_EVENT", id: event.id })}
      >
        Delete Event
      </button>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
