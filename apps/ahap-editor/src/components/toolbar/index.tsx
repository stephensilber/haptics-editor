import type { AhapEvent } from "../../lib/types";
import type { TimelineAction } from "../timeline";
import styles from "./styles.module.scss";

interface ToolbarProps {
  events: AhapEvent[];
  dispatch: React.Dispatch<TimelineAction>;
  addMode: "transient" | "continuous";
  onSetAddMode: (mode: "transient" | "continuous") => void;
  onPlay: () => void;
  playing: boolean;
  totalDuration: number;
  onShare?: () => void;
  onImport?: () => void;
  onDownload?: () => void;
  showShare?: boolean;
  showImport?: boolean;
  showDownload?: boolean;
}

export function Toolbar({
  events,
  dispatch,
  addMode,
  onSetAddMode,
  onPlay,
  playing,
  totalDuration,
  onShare,
  onImport,
  onDownload,
  showShare,
  showImport,
  showDownload,
}: ToolbarProps) {
  const handleClear = () => {
    dispatch({ type: "LOAD_EVENTS", events: [] });
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <div className={styles.addModeToggle}>
          <button
            data-active={addMode === "transient"}
            onClick={() => onSetAddMode("transient")}
            title="Add transient events (tap)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" fill="currentColor" />
            </svg>
            Transient
          </button>
          <button
            data-active={addMode === "continuous"}
            onClick={() => onSetAddMode("continuous")}
            title="Add continuous events (sustained)"
          >
            <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
              <rect width="16" height="8" rx="4" fill="currentColor" />
            </svg>
            Continuous
          </button>
        </div>
      </div>

      <div className={styles.right}>
        {totalDuration > 0 && (
          <span className={styles.duration}>{totalDuration.toFixed(2)}s</span>
        )}

        {events.length > 0 && (
          <button
            className={styles.iconButton}
            onClick={handleClear}
            title="Clear all"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <button
          className={styles.playButton}
          onClick={onPlay}
          disabled={events.length === 0 || playing}
        >
          <svg
            aria-label="Play"
            width="13"
            height="15"
            viewBox="0 0 15 17"
            fill="none"
          >
            <path
              d="M0.000323688 2.50385L0.000322723 13.6729C0.000322555 15.6161 2.12025 16.8164 3.78656 15.8166L13.0941 10.2321C14.7125 9.2611 14.7125 6.91565 13.0941 5.94465L3.78656 0.36012C2.12025 -0.639667 0.000323855 0.560616 0.000323688 2.50385Z"
              fill="currentColor"
            />
          </svg>
        </button>

        {showShare && (
          <button className={styles.actionButton} onClick={onShare}>
            Share
          </button>
        )}

        {showImport && (
          <button className={styles.actionButton} onClick={onImport}>
            Import
          </button>
        )}

        {showDownload && (
          <button
            className={styles.actionButton}
            data-primary
            onClick={onDownload}
          >
            Download .ahap
          </button>
        )}
      </div>
    </div>
  );
}
