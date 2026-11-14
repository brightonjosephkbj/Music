import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";

import {
  notifyDownloadProgress,
  notifyDownloadComplete,
  clearDownloadNotification,
} from "../services/notifications";

const DownloadsContext = createContext(null);

function safelyRun(task, label) {
  try {
    Promise.resolve(task()).catch((err) => {
      console.warn(`[Downloads] ${label} failed:`, err);
    });
  } catch (err) {
    console.warn(`[Downloads] ${label} failed:`, err);
  }
}

function invokeControl(control, label) {
  if (typeof control !== "function") return;

  safelyRun(control, label);
}

export function DownloadsProvider({ children }) {
  const [activeDownloads, setActiveDownloads] = useState(() => new Map());

  // Synchronous mirror of React state. This lets callbacks read the latest
  // download entry without relying on React updater execution timing.
  const activeDownloadsRef = useRef(activeDownloads);

  const cancelledKeysRef = useRef(new Set());
  const lastNotifiedPctRef = useRef(new Map());

  // All changes go through this helper. Updaters must remain pure.
  const commitDownloads = useCallback((updater) => {
    const previous = activeDownloadsRef.current;
    const next = updater(previous);

    if (next === previous) return;

    activeDownloadsRef.current = next;
    setActiveDownloads(next);
  }, []);

  const startDownload = useCallback((key, meta = {}) => {
    cancelledKeysRef.current.delete(key);
    lastNotifiedPctRef.current.set(key, -1);

    commitDownloads((prev) => {
      const next = new Map(prev);

      next.set(key, {
        key,
        title: meta.title || "Downloading...",
        progress: 0,
        status: "downloading",
        pause: null,
        resume: null,
        cancel: null,
      });

      return next;
    });

    safelyRun(
      () => notifyDownloadProgress(key, {
        title: meta.title,
        progress: 0,
      }),
      "progress notification"
    );
  }, [commitDownloads]);

  const updateProgress = useCallback((key, progress) => {
    const current = activeDownloadsRef.current.get(key);
    if (!current) return;

    const numericProgress = Number(progress);
    const safeProgress = Number.isFinite(numericProgress)
      ? Math.max(0, Math.min(1, numericProgress))
      : 0;

    commitDownloads((prev) => {
      const entry = prev.get(key);
      if (!entry) return prev;

      const next = new Map(prev);
      next.set(key, {
        ...entry,
        progress: safeProgress,
      });

      return next;
    });

    const pct = Math.floor(safeProgress * 20) * 5;
    const lastPct = lastNotifiedPctRef.current.get(key);

    if (pct !== lastPct) {
      lastNotifiedPctRef.current.set(key, pct);

      safelyRun(
        () => notifyDownloadProgress(key, {
          title: current.title,
          progress: safeProgress,
        }),
        "progress notification"
      );
    }
  }, [commitDownloads]);

  const setStatus = useCallback((key, status) => {
    commitDownloads((prev) => {
      const entry = prev.get(key);
      if (!entry) return prev;

      const next = new Map(prev);
      next.set(key, { ...entry, status });
      return next;
    });
  }, [commitDownloads]);

  const registerControls = useCallback((key, controls) => {
    commitDownloads((prev) => {
      const entry = prev.get(key);
      if (!entry) return prev;

      const next = new Map(prev);
      next.set(key, { ...entry, ...controls });
      return next;
    });
  }, [commitDownloads]);

  const finishDownload = useCallback((key, { success = true } = {}) => {
    const entry = activeDownloadsRef.current.get(key);

    lastNotifiedPctRef.current.delete(key);

    if (!entry) return;

    commitDownloads((prev) => {
      if (!prev.has(key)) return prev;

      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    if (success) {
      safelyRun(
        () => notifyDownloadComplete(key, { title: entry.title }),
        "completion notification"
      );
    } else {
      safelyRun(
        () => clearDownloadNotification(key),
        "notification cleanup"
      );
    }
  }, [commitDownloads]);

  const pauseDownload = useCallback((key) => {
    const entry = activeDownloadsRef.current.get(key);
    if (!entry || typeof entry.pause !== "function") return;

    invokeControl(entry.pause, "pause");
    setStatus(key, "paused");
  }, [setStatus]);

  const resumeDownload = useCallback((key) => {
    const entry = activeDownloadsRef.current.get(key);
    if (!entry || typeof entry.resume !== "function") return;

    invokeControl(entry.resume, "resume");
    setStatus(key, "downloading");
  }, [setStatus]);

  const cancelDownload = useCallback((key) => {
    cancelledKeysRef.current.add(key);

    const entry = activeDownloadsRef.current.get(key);

    if (entry?.cancel) {
      invokeControl(entry.cancel, "cancel");
    }

    finishDownload(key, { success: false });
  }, [finishDownload]);

  const isCancelled = useCallback(
    (key) => cancelledKeysRef.current.has(key),
    []
  );

  const hasActiveDownloads = activeDownloads.size > 0;

  const value = useMemo(
    () => ({
      activeDownloads,
      hasActiveDownloads,
      startDownload,
      updateProgress,
      finishDownload,
      registerControls,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      isCancelled,
    }),
    [
      activeDownloads,
      hasActiveDownloads,
      startDownload,
      updateProgress,
      finishDownload,
      registerControls,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      isCancelled,
    ]
  );

  return (
    <DownloadsContext.Provider value={value}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);

  if (!ctx) {
    throw new Error("useDownloads must be used within a DownloadsProvider");
  }

  return ctx;
}
