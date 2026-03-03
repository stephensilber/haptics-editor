import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import {
  Timeline,
  reducer,
  createInitialState,
} from "../components/timeline";
import type { TimelineHandle } from "../components/timeline";
import { EventInspector } from "../components/event-inspector";
import { Toolbar } from "../components/toolbar";
import { eventsToAhap } from "../lib/ahap";
import { encodeProject, getProjectFromUrl } from "../lib/share";
import styles from "./styles.module.scss";

export default function MobileView() {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const urlProject = getProjectFromUrl();
    if (urlProject) {
      return { events: urlProject.events, selectedId: null };
    }
    return createInitialState();
  });
  const [addMode, setAddMode] = useState<"transient" | "continuous">(
    "transient",
  );
  const [copied, setCopied] = useState(false);
  const timelineRef = useRef<TimelineHandle>(null);

  const selectedEvent = state.events.find((e) => e.id === state.selectedId);

  const totalDuration = state.events.length
    ? Math.max(
        ...state.events.map((e) =>
          e.time + (e.type === "continuous" ? e.duration : 0.03),
        ),
      )
    : 0;

  const handleShare = useCallback(() => {
    const project = { name: "AHAP Pattern", events: state.events };
    const encoded = encodeProject(project);
    const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [state.events]);

  const handlePlay = useCallback(() => {
    timelineRef.current?.play();
  }, []);

  useEffect(() => {
    const handler = () => {
      const project = getProjectFromUrl();
      if (project) {
        dispatch({ type: "LOAD_EVENTS", events: project.events });
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return (
    <div className={styles.mobileView}>
      <header className={styles.header}>
        <h1>AHAP Editor</h1>
      </header>

      <Toolbar
        events={state.events}
        dispatch={dispatch}
        addMode={addMode}
        onSetAddMode={setAddMode}
        onPlay={handlePlay}
        playing={timelineRef.current?.playing ?? false}
        totalDuration={totalDuration}
        onShare={handleShare}
        showShare
      />

      <Timeline ref={timelineRef} state={state} dispatch={dispatch} addMode={addMode} debug={false} />

      {selectedEvent && (
        <EventInspector event={selectedEvent} dispatch={dispatch} />
      )}

      {copied && <div className={styles.toast}>Link copied to clipboard</div>}

      {state.events.length > 0 && (
        <details className={styles.preview}>
          <summary>AHAP JSON</summary>
          <pre>
            <code>{eventsToAhap(state.events, { name: "AHAP Pattern" })}</code>
          </pre>
        </details>
      )}
    </div>
  );
}
