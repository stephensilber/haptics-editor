import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import {
  Timeline,
  reducer,
  createInitialState,
} from "../components/timeline";
import type { TimelineHandle } from "../components/timeline";
import { EventInspector } from "../components/event-inspector";
import { Toolbar } from "../components/toolbar";
import { eventsToAhap, ahapToEvents } from "../lib/ahap";
import { encodeProject, decodeProject, getProjectFromUrl } from "../lib/share";
import styles from "./styles.module.scss";

export default function DesktopView() {
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<TimelineHandle>(null);

  const selectedEvent = state.events.find((e) => e.id === state.selectedId);
  const ahapJson = state.events.length
    ? eventsToAhap(state.events, { name: "AHAP Pattern" })
    : "";

  const totalDuration = state.events.length
    ? Math.max(
        ...state.events.map((e) =>
          e.time + (e.type === "continuous" ? e.duration : 0.03),
        ),
      )
    : 0;

  const handlePlay = useCallback(() => {
    timelineRef.current?.play();
  }, []);

  const handleShare = useCallback(() => {
    const project = { name: "AHAP Pattern", events: state.events };
    const encoded = encodeProject(project);
    const url = `${window.location.origin}${window.location.pathname}#data=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [state.events]);

  const handleDownload = useCallback(() => {
    if (!ahapJson) return;
    const blob = new Blob([ahapJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pattern.ahap";
    a.click();
    URL.revokeObjectURL(url);
  }, [ahapJson]);

  const handleImport = useCallback(() => {
    setShowImportModal(true);
    setImportText("");
    setImportError("");
    setTimeout(() => importRef.current?.focus(), 50);
  }, []);

  const handleImportSubmit = useCallback(() => {
    const text = importText.trim();
    if (!text) return;

    if (text.includes("#data=")) {
      try {
        const hash = text.split("#data=")[1]!;
        const project = decodeProject(hash);
        dispatch({ type: "LOAD_EVENTS", events: project.events });
        setShowImportModal(false);
        return;
      } catch {
        // Fall through to try as raw AHAP JSON
      }
    }

    try {
      const events = ahapToEvents(text);
      if (events.length === 0) {
        setImportError("No haptic events found in the AHAP JSON.");
        return;
      }
      dispatch({ type: "LOAD_EVENTS", events });
      setShowImportModal(false);
    } catch {
      setImportError("Invalid AHAP JSON. Please paste a valid AHAP file.");
    }
  }, [importText]);

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

  const handleCopyJson = useCallback(() => {
    if (!ahapJson) return;
    navigator.clipboard.writeText(ahapJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [ahapJson]);

  return (
    <div className={styles.desktopView}>
      <header className={styles.header}>
        <h1>AHAP Editor</h1>
        <p className={styles.subtitle}>
          Design iOS Core Haptics patterns
        </p>
      </header>

      <div className={styles.editorLayout}>
        <div className={styles.editorMain}>
          <Toolbar
            events={state.events}
            dispatch={dispatch}
            addMode={addMode}
            onSetAddMode={setAddMode}
            onPlay={handlePlay}
            playing={timelineRef.current?.playing ?? false}
            totalDuration={totalDuration}
            onShare={handleShare}
            onImport={handleImport}
            onDownload={handleDownload}
            showShare
            showImport
            showDownload
          />

          <Timeline ref={timelineRef} state={state} dispatch={dispatch} addMode={addMode} />

          {selectedEvent && (
            <EventInspector event={selectedEvent} dispatch={dispatch} />
          )}
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>AHAP Output</h3>
            <button
              className={styles.copyButton}
              onClick={handleCopyJson}
              disabled={!ahapJson}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className={styles.codePreview}>
            <code>
              {ahapJson || "// Add events to see AHAP output"}
            </code>
          </pre>
        </div>
      </div>

      {showImportModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowImportModal(false)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Import AHAP</h3>
            <p>Paste an AHAP JSON file or a shared link.</p>
            <textarea
              ref={importRef}
              className={styles.importTextarea}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError("");
              }}
              placeholder='{"Version": 1.0, "Pattern": [...]}'
              rows={8}
            />
            {importError && (
              <p className={styles.importError}>{importError}</p>
            )}
            <div className={styles.modalActions}>
              <button onClick={() => setShowImportModal(false)}>Cancel</button>
              <button data-primary onClick={handleImportSubmit}>
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
