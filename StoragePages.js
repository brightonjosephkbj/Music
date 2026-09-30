import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, AppState, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NEU, Raised, Inset, NeuRow, NeuButton, SectionTitle } from "./Neu";
import { getDownloads, removeDownload, getTrash } from "./libraryStorage";
import { getListeningHistory } from "./listeningHistory";
import { fmtBytes, getDiskInfo, scanDownloadSizes, getCacheSize, clearCache } from "./storageScan";
import { findDuplicates, findLargeVideos, findNeverPlayed } from "./storageAnalysis";
import {
  TRASH_DAYS, daysLeft, mergeReferences, restoreEntries, purgeEntries, emptyTrash, resetTrash,
  hasTrashPassword, setTrashPassword, checkTrashPassword,
} from "./trash";

const Chevron = () => <Ionicons name="chevron-forward" size={18} color={NEU.muted} />;

function CheckRow({ checked, onToggle, title, subtitle, right, disabled }) {
  return (
    <TouchableOpacity onPress={disabled ? undefined : onToggle} activeOpacity={0.75} style={st.checkRow}>
      <Inset radius={8} style={st.box}>
        {(checked || disabled) && <Ionicons name={disabled ? "lock-closed" : "checkmark"} size={14} color={NEU.orchid} />}
      </Inset>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={st.chTitle}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={st.chSub}>{subtitle}</Text>}
      </View>
      {right}
    </TouchableOpacity>
  );
}

function UsageBar({ segs, total }) {
  return (
    <Inset radius={10} style={{ height: 20, padding: 3 }}>
      <View style={{ flex: 1, flexDirection: "row", borderRadius: 7, overflow: "hidden" }}>
        {segs.map((s) =>
          s.bytes > 0 && s.bar !== false ? (
            <View key={s.key} style={{ width: `${Math.max(0.6, (s.bytes / total) * 100)}%`, backgroundColor: s.color }} />
          ) : null
        )}
      </View>
    </Inset>
  );
}

// ======================= STORAGE =======================
export function StoragePage({ onOpenTrash }) {
  const [d, setD] = useState(null);
  const [progress, setProgress] = useState(null);
  const [view, setView] = useState("main"); // main | dupes | videos | unplayed
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    const [downloads, history, disk, trash] = await Promise.all([
      getDownloads(), getListeningHistory().catch(() => []), getDiskInfo(), getTrash(),
    ]);
    const sizes = await scanDownloadSizes([...downloads, ...trash], (n, t) => alive.current && setProgress({ n, t }));
    const cacheBytes = await getCacheSize();
    if (!alive.current) return;
    setProgress(null);
    const sz = (x) => sizes.get(x.id) || 0;
    const sum = (arr) => arr.reduce((a, x) => a + sz(x), 0);
    setD({
      disk, cacheBytes, sizes, trashCount: trash.length, trashBytes: sum(trash),
      audioBytes: sum(downloads.filter((x) => x.type !== "video")),
      videoBytes: sum(downloads.filter((x) => x.type === "video")),
      dupes: findDuplicates(downloads, sizes),
      videos: findLargeVideos(downloads, sizes),
      unplayed: findNeverPlayed(downloads, history, sizes),
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (v) => {
    if (v === "dupes") setPicked(new Set(d.dupes.flatMap((g) => g.remove.map((r) => r.id))));
    else setPicked(new Set());
    setView(v);
  };
  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const moveToTrash = async () => {
    setBusy(true);
    try {
      if (view === "dupes") {
        const map = new Map();
        d.dupes.forEach((g) => g.remove.forEach((r) => picked.has(r.id) && map.set(r.id, g.keep.id)));
        await mergeReferences(map);
      }
      for (const id of picked) await removeDownload(id);
    } finally {
      setBusy(false);
    }
    setPicked(new Set());
    setView("main");
    load();
    Alert.alert("Moved to trash", `Space is freed when you empty the trash, or automatically after ${TRASH_DAYS} days.`);
  };

  const askClearCache = () =>
    Alert.alert("Clear cache?", "Removes temporary files. Your songs, videos and playlists are not touched.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", onPress: async () => { await clearCache(); load(); } },
    ]);

  if (!d) {
    return (
      <Raised style={{ marginBottom: 22 }} faceStyle={{ padding: 24, alignItems: "center" }}>
        <ActivityIndicator color={NEU.orchid} />
        <Text style={[st.chSub, { marginTop: 10 }]}>
          {progress ? `Measuring files ${progress.n}/${progress.t}` : "Checking storage..."}
        </Text>
      </Raised>
    );
  }

  const sz = (x) => d.sizes.get(x.id) || 0;

  // ---------- detail views ----------
  if (view !== "main") {
    const titles = { dupes: "Duplicate songs", videos: "Large videos", unplayed: "Never played" };
    const selBytes = [...picked].reduce((a, id) => a + (d.sizes.get(id) || 0), 0);
    return (
      <>
        <TouchableOpacity onPress={() => setView("main")} style={{ marginBottom: 12 }}>
          <Text style={{ color: NEU.orchid, fontWeight: "700" }}>‹ Storage</Text>
        </TouchableOpacity>
        <SectionTitle>{titles[view]}</SectionTitle>
        <Raised style={{ marginBottom: 18 }}>
          {view === "dupes" &&
            d.dupes.map((g) => (
              <View key={g.keep.id} style={st.group}>
                <CheckRow disabled title={g.keep.title} subtitle={`Keeping this copy · ${g.keep.artist || ""}`} right={<Text style={st.size}>{fmtBytes(sz(g.keep))}</Text>} />
                {g.remove.map((r) => (
                  <CheckRow key={r.id} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} title={r.title} subtitle={`Extra copy · ${r.artist || ""}`} right={<Text style={st.size}>{fmtBytes(sz(r))}</Text>} />
                ))}
              </View>
            ))}
          {view === "videos" &&
            d.videos.map((r) => (
              <CheckRow key={r.id} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} title={r.title} subtitle={r.artist} right={<Text style={st.size}>{fmtBytes(sz(r))}</Text>} />
            ))}
          {view === "unplayed" &&
            d.unplayed.map((r) => (
              <CheckRow key={r.id} checked={picked.has(r.id)} onToggle={() => toggle(r.id)} title={r.title} subtitle={r.artist} right={<Text style={st.size}>{fmtBytes(sz(r))}</Text>} />
            ))}
        </Raised>
        <NeuButton
          label={`Move ${picked.size} to trash${selBytes ? ` · ${fmtBytes(selBytes)}` : ""}`}
          icon="trash-outline"
          primary
          disabled={picked.size === 0 || busy}
          onPress={moveToTrash}
        />
        <Text style={[st.note, { marginTop: 12 }]}>
          Songs stay in the trash for {TRASH_DAYS} days, so you can bring them back.
        </Text>
      </>
    );
  }

  // ---------- main view ----------
  const { disk } = d;
  const used = Math.max(0, disk.total - disk.free);
  const other = Math.max(0, used - d.audioBytes - d.videoBytes - d.cacheBytes - d.trashBytes);
  const segs = [
    { key: "a", label: "Songs", color: NEU.orchid, bytes: d.audioBytes },
    { key: "v", label: "Videos", color: "#7FB4E8", bytes: d.videoBytes },
    { key: "t", label: "Trash", color: "#FF7A90", bytes: d.trashBytes },
    { key: "c", label: "Cache", color: "#FFC857", bytes: d.cacheBytes },
    { key: "o", label: "Other", color: "#5A5370", bytes: other },
    { key: "f", label: "Free", color: "rgba(255,255,255,0.25)", bytes: disk.free, bar: false },
  ];

  const dupeSave = d.dupes.reduce((a, g) => a + g.saves, 0);
  const dupeCount = d.dupes.reduce((a, g) => a + g.remove.length, 0);
  const sumOf = (arr) => arr.reduce((a, x) => a + sz(x), 0);
  const rows = [];
  if (d.dupes.length) rows.push({ icon: "copy-outline", title: "Duplicate songs", subtitle: `${dupeCount} extra copies · frees ${fmtBytes(dupeSave)}`, onPress: () => open("dupes") });
  if (d.videos.length) rows.push({ icon: "videocam-outline", title: "Large videos", subtitle: `${d.videos.length} videos · ${fmtBytes(sumOf(d.videos))}`, onPress: () => open("videos") });
  if (d.unplayed.length) rows.push({ icon: "eye-off-outline", title: "Never played", subtitle: `${d.unplayed.length} songs · ${fmtBytes(sumOf(d.unplayed))}`, onPress: () => open("unplayed") });
  if (d.cacheBytes > 5 * 1024 * 1024) rows.push({ icon: "flash-outline", title: "Clear cache", subtitle: `${fmtBytes(d.cacheBytes)} of temporary files`, onPress: askClearCache });

  return (
    <>
      <Raised style={{ marginBottom: 22 }} faceStyle={{ padding: 18 }}>
        <Text style={st.big}>{disk.total ? `${fmtBytes(used)} used` : "Storage"}</Text>
        {!!disk.total && <Text style={st.chSub}>{fmtBytes(disk.free)} free of {fmtBytes(disk.total)}</Text>}
        {!!disk.total && <View style={{ marginTop: 14 }}><UsageBar segs={segs} total={disk.total} /></View>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
          {segs.map((s) => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.color }} />
              <Text style={st.legend}>{s.label} {fmtBytes(s.bytes)}</Text>
            </View>
          ))}
        </View>
      </Raised>

      <SectionTitle>Suggestions</SectionTitle>
      <Raised style={{ marginBottom: 22 }}>
        {rows.length === 0 ? (
          <Text style={[st.chSub, { padding: 18 }]}>Nothing to clean up right now.</Text>
        ) : (
          rows.map((r, i) => <NeuRow key={r.title} {...r} last={i === rows.length - 1} right={<Chevron />} />)
        )}
      </Raised>

      <SectionTitle>Trash</SectionTitle>
      <Raised style={{ marginBottom: 14 }}>
        <NeuRow
          icon="trash-outline"
          title="Trash"
          subtitle={`${d.trashCount} item${d.trashCount === 1 ? "" : "s"} · ${fmtBytes(d.trashBytes)} · kept ${TRASH_DAYS} days · locked`}
          last
          onPress={onOpenTrash}
          right={<Chevron />}
        />
      </Raised>
      <Text style={st.note}>
        Sizes cover songs and videos downloaded in the app. Songs found by scanning your phone are not included.
      </Text>
    </>
  );
}

// ======================= TRASH =======================
export function TrashPage() {
  const [phase, setPhase] = useState("loading"); // loading | setup | locked | open
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState(null);
  const [items, setItems] = useState([]);
  const [sizes, setSizes] = useState(new Map());
  const [picked, setPicked] = useState(new Set());
  const [changing, setChanging] = useState(false);
  const attempts = useRef({ n: 0, until: 0 });

  useEffect(() => { hasTrashPassword().then((h) => setPhase(h ? "locked" : "setup")); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") {
        setPhase((p) => (p === "open" ? "locked" : p));
        setPw("");
        setChanging(false);
      }
    });
    return () => sub.remove();
  }, []);

  const loadItems = useCallback(async () => {
    const list = (await getTrash()).sort((a, b) => (a.deletedAt || 0) - (b.deletedAt || 0));
    setItems(list);
    setPicked(new Set());
    setSizes(await scanDownloadSizes(list));
  }, []);

  const unlock = async () => {
    const now = Date.now();
    if (now < attempts.current.until) {
      setErr(`Too many tries. Wait ${Math.ceil((attempts.current.until - now) / 1000)}s.`);
      return;
    }
    if (await checkTrashPassword(pw)) {
      attempts.current = { n: 0, until: 0 };
      setErr(null);
      setPw("");
      await loadItems();
      setPhase("open");
    } else {
      attempts.current.n += 1;
      if (attempts.current.n >= 5) {
        attempts.current = { n: 0, until: now + 30000 };
        setErr("Too many tries. Wait 30s.");
      } else setErr("Wrong password.");
    }
  };

  const savePw = async () => {
    if (pw.length < 4) return setErr("Use at least 4 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    await setTrashPassword(pw);
    setErr(null); setPw(""); setPw2(""); setChanging(false);
    await loadItems();
    setPhase("open");
  };

  const forgot = () =>
    Alert.alert(
      "Erase trash?",
      "Without the password, the only way back in is to permanently erase everything in the trash and set a new password.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Erase trash", style: "destructive", onPress: async () => { await resetTrash(); setPw(""); setErr(null); setPhase("setup"); } },
      ]
    );

  const report = (r) =>
    Alert.alert(
      "Done",
      r.failed
        ? `${r.failed} file(s) couldn't be deleted from phone storage (they may be saved in your Music folder). Remove them with your Files app.`
        : "Removed from your phone."
    );
  const chosen = () => items.filter((i) => picked.has(i.id));
  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const doRestore = async () => { await restoreEntries(chosen()); await loadItems(); };
  const doDelete = () =>
    Alert.alert("Delete forever?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { report(await purgeEntries(chosen())); await loadItems(); } },
    ]);
  const doEmpty = () =>
    Alert.alert("Empty trash?", "Everything in the trash is deleted forever.", [
      { text: "Cancel", style: "cancel" },
      { text: "Empty", style: "destructive", onPress: async () => { report(await emptyTrash()); await loadItems(); } },
    ]);

  if (phase === "loading") return <ActivityIndicator color={NEU.orchid} style={{ marginTop: 30 }} />;

  if (phase === "setup" || changing) {
    return (
      <Raised faceStyle={{ padding: 20 }} style={{ marginBottom: 20 }}>
        <Ionicons name="lock-closed" size={26} color={NEU.orchid} />
        <Text style={st.big}>{changing ? "New trash password" : "Set a trash password"}</Text>
        <Text style={[st.note, { marginBottom: 14 }]}>
          The trash asks for this password each time you open it. If you forget it, the only way back in is to erase the trash.
        </Text>
        <Inset radius={12} style={st.field}>
          <TextInput style={st.input} value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={NEU.muted} secureTextEntry autoCapitalize="none" />
        </Inset>
        <Inset radius={12} style={st.field}>
          <TextInput style={st.input} value={pw2} onChangeText={setPw2} placeholder="Repeat password" placeholderTextColor={NEU.muted} secureTextEntry autoCapitalize="none" />
        </Inset>
        {!!err && <Text style={st.err}>{err}</Text>}
        <NeuButton label="Save password" primary onPress={savePw} />
      </Raised>
    );
  }

  if (phase === "locked") {
    return (
      <Raised faceStyle={{ padding: 20 }} style={{ marginBottom: 20 }}>
        <Ionicons name="lock-closed" size={26} color={NEU.orchid} />
        <Text style={st.big}>Trash is locked</Text>
        <Inset radius={12} style={[st.field, { marginTop: 14 }]}>
          <TextInput style={st.input} value={pw} onChangeText={setPw} placeholder="Password" placeholderTextColor={NEU.muted} secureTextEntry autoCapitalize="none" onSubmitEditing={unlock} />
        </Inset>
        {!!err && <Text style={st.err}>{err}</Text>}
        <NeuButton label="Unlock" icon="lock-open-outline" primary onPress={unlock} />
        <TouchableOpacity onPress={forgot} style={{ marginTop: 16, alignSelf: "center" }}>
          <Text style={{ color: NEU.muted, fontSize: 13 }}>Forgot password?</Text>
        </TouchableOpacity>
      </Raised>
    );
  }

  const totalBytes = items.reduce((a, i) => a + (sizes.get(i.id) || 0), 0);
  return (
    <>
      <Text style={st.note}>
        {items.length} item{items.length === 1 ? "" : "s"} · {fmtBytes(totalBytes)}. Deleted songs are removed automatically after {TRASH_DAYS} days.
      </Text>
      {items.length === 0 ? (
        <Raised faceStyle={{ padding: 20, alignItems: "center" }} style={{ marginBottom: 20 }}>
          <Text style={st.chSub}>The trash is empty.</Text>
        </Raised>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
            style={{ marginBottom: 10 }}
          >
            <Text style={{ color: NEU.orchid, fontWeight: "700" }}>{picked.size === items.length ? "Select none" : "Select all"}</Text>
          </TouchableOpacity>
          <Raised style={{ marginBottom: 18 }}>
            {items.map((i) => (
              <CheckRow
                key={i.id}
                checked={picked.has(i.id)}
                onToggle={() => toggle(i.id)}
                title={i.title}
                subtitle={`${i.artist || ""} · ${fmtBytes(sizes.get(i.id) || 0)}`}
                right={<Text style={[st.size, daysLeft(i) <= 2 && { color: NEU.danger }]}>{daysLeft(i)}d left</Text>}
              />
            ))}
          </Raised>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <NeuButton style={{ flex: 1 }} label="Restore" icon="arrow-undo-outline" primary disabled={!picked.size} onPress={doRestore} />
            <NeuButton style={{ flex: 1 }} label="Delete" icon="trash" danger disabled={!picked.size} onPress={doDelete} />
          </View>
          <NeuButton label="Empty trash" icon="flame-outline" danger onPress={doEmpty} />
        </>
      )}
      <TouchableOpacity onPress={() => { setPw(""); setPw2(""); setErr(null); setChanging(true); }} style={{ marginTop: 20, alignSelf: "center" }}>
        <Text style={{ color: NEU.muted, fontSize: 13 }}>Change password</Text>
      </TouchableOpacity>
    </>
  );
}

const st = StyleSheet.create({
  big: { color: NEU.text, fontSize: 20, fontWeight: "800", marginTop: 6 },
  note: { color: NEU.muted, fontSize: 12.5, lineHeight: 18, marginLeft: 4, marginBottom: 12 },
  legend: { color: NEU.muted, fontSize: 12 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  box: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  chTitle: { color: NEU.text, fontSize: 14.5, fontWeight: "700" },
  chSub: { color: NEU.muted, fontSize: 12, marginTop: 2 },
  size: { color: NEU.muted, fontSize: 12, fontWeight: "700" },
  group: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", paddingVertical: 4 },
  field: { paddingHorizontal: 14, marginBottom: 12 },
  input: { color: NEU.text, fontSize: 16, paddingVertical: 12 },
  err: { color: NEU.danger, fontSize: 13, marginBottom: 10 },
});
