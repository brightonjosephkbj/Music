import { useState, useRef, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE, authedHeaders } from "./apiClient";
import { getPlaybackState, togglePlayback } from "./playbackBridge";

const SPEECH_DB = -38;
const SPEECH_DB_MUSIC = -26;
const SILENCE_MS = 900;
const POLL_MS = 120;
const MIN_SPEECH_MS = 400;
const IDLE_RESET_MS = 8000;
const WAKE_MAX_MS = 8000;
const CMD_WAIT_MS = 8000;
const CMD_MAX_MS = 15000;
const MIN_WAKE_GAP_MS = 2500;
const FAILSAFE_RESUME_MS = 30000;

const WAKE_RE = /\b(hi|hey|high|hay|hai)[\s,.!-]*(joy|joey|joi|joie)\b/i;
const JUNK_RE = /^(thanks?( you)?( for watching)?|you|bye|okay|\.+)[.!\s]*$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rm = (u) => FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {});

function explain(e) {
  const m = String(e?.message || e);
  if (m.includes("404")) return "Server has no /transcribe route yet. Push Api-cache to the Space.";
  if (m.includes("401") || m.includes("403")) return "Server rejected the request (gateway key or auth).";
  if (m.includes("502") || m.includes("503")) return "Server or Groq unavailable (" + m + ").";
  return "Couldn't transcribe: " + m;
}

async function transcribe(uri) {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const res = await fetch(`${API_BASE}/api/apicache/api/ai/transcribe`, {
    method: "POST",
    headers: await authedHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      audio_b64: b64,
      filename: "clip.m4a",
      mime: "audio/m4a",
      prompt: "Hi Joy. Hey Joy, play some music.",
    }),
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const j = await res.json();
  return (j.text || "").trim();
}

export default function useJoyVoice({ onCommand } = {}) {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    isMeteringEnabled: true,
  });
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;
  const cmdRef = useRef(onCommand);
  cmdRef.current = onCommand;

  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [db, setDb] = useState(-60);
  const [hearing, setHearing] = useState(false);
  const [heard, setHeard] = useState(null);
  const [note, setNote] = useState("");

  const activeRef = useRef(false);
  const runningRef = useRef(false);
  const phaseRef = useRef("idle");
  const pausedRef = useRef(false);
  const failsafeRef = useRef(null);
  const lastDbRef = useRef(-60);
  const hearingRef = useRef(false);

  const go = useCallback((p) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const setHearingSafe = useCallback((v) => {
    if (hearingRef.current !== v) {
      hearingRef.current = v;
      setHearing(v);
    }
  }, []);

  const pauseMusic = useCallback(() => {
    try {
      if (getPlaybackState().isPlaying) {
        togglePlayback();
        pausedRef.current = true;
      }
    } catch {}
  }, []);

  const resumeMusic = useCallback(() => {
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    if (!pausedRef.current) return;
    pausedRef.current = false;
    try {
      if (!getPlaybackState().isPlaying) togglePlayback();
    } catch {}
  }, []);

  const cancelResume = useCallback(() => {
    pausedRef.current = false;
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
  }, []);

  const recordSegment = useCallback(async (kind) => {
    const rec = recorderRef.current;
    await rec.prepareToRecordAsync();
    rec.record();
    const t0 = Date.now();
    let speechStart = 0;
    let lastLoud = 0;
    let meterSeen = false;
    return new Promise((resolve) => {
      let done = false;
      const finish = async (keep) => {
        if (done) return;
        done = true;
        clearInterval(iv);
        setHearingSafe(false);
        let uri = null;
        try {
          await rec.stop();
          uri = rec.uri;
        } catch {}
        resolve(keep && uri ? { uri } : null);
      };
      const iv = setInterval(() => {
        if (done) return;
        if (!activeRef.current) return finish(false);
        let level = -160;
        try {
          const m = rec.getStatus().metering;
          if (typeof m === "number") {
            level = m;
            meterSeen = true;
          }
        } catch {}
        const now = Date.now();
        if (!meterSeen && now - t0 > 2000) {
          setNote("No mic level - the recorder isn't reporting volume.");
        }
        const shown = Math.max(-60, level);
        if (Math.abs(shown - lastDbRef.current) >= 3) {
          lastDbRef.current = shown;
          setDb(Math.round(shown));
        }
        const thr = getPlaybackState().isPlaying ? SPEECH_DB_MUSIC : SPEECH_DB;
        if (level > thr) {
          if (!speechStart) {
            speechStart = now;
            setHearingSafe(true);
          }
          lastLoud = now;
        }
        if (speechStart) {
          if (now - lastLoud > SILENCE_MS) return finish(lastLoud - speechStart >= MIN_SPEECH_MS);
          if (now - speechStart > (kind === "cmd" ? CMD_MAX_MS : WAKE_MAX_MS)) return finish(kind === "cmd");
        } else if (now - t0 > (kind === "cmd" ? CMD_WAIT_MS : IDLE_RESET_MS)) {
          return finish(false);
        }
      }, POLL_MS);
    });
  }, [setHearingSafe]);

  const loop = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    let lastUpload = 0;
    const dispatch = (text) => {
      failsafeRef.current = setTimeout(resumeMusic, FAILSAFE_RESUME_MS);
      try {
        cmdRef.current && cmdRef.current(text);
      } catch {}
    };
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone needed", "Allow microphone access to use Hi Joy.");
        activeRef.current = false;
        setListening(false);
        go("idle");
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch (e) {
        setNote("Audio mode: " + String(e?.message || e));
      }
      go("wake");
      while (activeRef.current) {
        const inCmd = phaseRef.current === "command";
        const seg = await recordSegment(inCmd ? "cmd" : "wake");
        if (!activeRef.current) {
          if (seg) rm(seg.uri);
          break;
        }
        if (!seg) {
          if (inCmd) {
            go("wake");
            resumeMusic();
          }
          continue;
        }
        if (!inCmd) {
          if (Date.now() - lastUpload < MIN_WAKE_GAP_MS) {
            rm(seg.uri);
            continue;
          }
          lastUpload = Date.now();
        }
        go("processing");
        let text = "";
        let failed = false;
        try {
          text = await transcribe(seg.uri);
          setNote("");
        } catch (e) {
          failed = true;
          setHeard(null);
          setNote(explain(e));
        }
        rm(seg.uri);
        if (!activeRef.current) break;
        if (!failed) {
          setHeard({ text: text || "(couldn't make out any words)", wake: WAKE_RE.test(text) || inCmd });
        }
        if (inCmd) {
          if (text.length >= 2 && !JUNK_RE.test(text)) dispatch(text);
          else resumeMusic();
          go("wake");
        } else {
          const m = text.match(WAKE_RE);
          if (!m) {
            go("wake");
            continue;
          }
          pauseMusic();
          const rest = text.slice(m.index + m[0].length).replace(/^[\s,.:;!?-]+/, "").trim();
          if (rest.length >= 3) {
            dispatch(rest);
            go("wake");
          } else {
            go("command");
          }
        }
      }
    } catch (e) {
      setNote("Recorder error: " + String(e?.message || e));
      activeRef.current = false;
      setListening(false);
      go("idle");
    } finally {
      runningRef.current = false;
    }
  }, [go, recordSegment, pauseMusic, resumeMusic]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setListening(true);
    setNote("");
    setHeard(null);
    (async () => {
      let n = 0;
      while (runningRef.current && n++ < 20) await sleep(150);
      if (activeRef.current) loop();
    })();
  }, [loop]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    setHearingSafe(false);
    go("idle");
    resumeMusic();
  }, [go, resumeMusic, setHearingSafe]);

  const toggle = useCallback(() => (activeRef.current ? stop() : start()), [start, stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      resumeMusic();
    },
    []
  );

  return {
    listening, phase, hearing, db, heard, note,
    threshold: SPEECH_DB,
    toggle, start, stop, resumeMusic, cancelResume,
  };
}
