import "react-native-gesture-handler"; // must be the very first import, before anything else

import React, { useState, useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AppShell from "./AppShell";
import HomeScreen from "./HomeScreen";
import LibraryScreen from "./LibraryScreen";
import NewsScreen from "./NewsScreen";
import RestScreen from "./RestScreen";
import usePlaybackEngine from "./usePlaybackEngine";
import PlayerCard from "./PlayerCard";
import PasteUrlScreen from "./PasteUrlScreen";
import SearchScreen from "./SearchScreen";
import ArtScreen from "./ArtScreen";
import WeatherScreen from "./WeatherScreen";
import TriviaScreen from "./TriviaScreen";
import JokesScreen from "./JokesScreen";
import FoodScreen from "./FoodScreen";
import RecentScreen from "./RecentScreen";
import MostPlayedScreen from "./MostPlayedScreen";
import AIChatScreen from "./AIChatScreen";
import InboxScreen from "./InboxScreen"; /* app_inbox_wiring_patch */
import ShareThreadScreen from "./ShareThreadScreen";
import FullscreenVideoPlayer from "./FullscreenVideoPlayer";
import SettingsScreen from "./SettingsScreen";
import UpdatePrompt from "./UpdatePrompt";
import { checkForUpdate } from "./otaClient";
import { DownloadsProvider } from "./DownloadsContext";
import MusicInfo from "expo-music-info-2";
import { getCachedArtwork, setCachedArtwork } from "./deviceArtworkCache";
import {
  registerForPushNotificationsAsync,
  addDownloadNotificationResponseListener,
  getLastDownloadNotificationKeyAsync,
  addShareNotificationResponseListener,
  getLastShareFromUserIdAsync,
} from "./notifications";
import { registerPushToken } from "./apiClient";
import { listFriends } from "./shareClient";
import LoginScreen, { getStoredAuth, clearStoredAuth, updateStoredAuth } from "./LoginScreen";
import { generateAIPlaylist } from "./aiPlaylist";
import { registerPlaybackControls, initMediaControls } from "./playbackBridge";
import { updateNowPlayingWidget } from "./nowPlayingWidget";
import { fetchLyrics, activeLyricIndex } from "./lyricsClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Device-scanned tracks skip ID3 reading in bulk (see localMediaScanner.js -
// hundreds of native-bridge calls at once was the actual lag source). So
// artwork is fetched lazily, one file, only when that track actually starts
// playing - cached after the first read so repeat plays are instant.
async function resolveDeviceArtwork(track, setNowPlaying) {
  if (!track || track.source !== "device" || track.artwork) return;

  const cached = await getCachedArtwork(track.id);
  if (cached) {
    setNowPlaying((current) =>
      current && current.id === track.id ? { ...current, artwork: cached } : current
    );
    return;
  }

  try {
    const meta = await MusicInfo.getMusicInfoAsync(track.localUri, {
      title: false,
      artist: false,
      album: false,
      picture: true,
    });
    const uri = meta?.picture?.pictureData;
    if (!uri) return; // file just has no embedded art - fine, leave it blank
    setCachedArtwork(track.id, uri); // fire-and-forget
    // Guard: only apply if this is still the track actually playing -
    // otherwise a quick skip could paint art onto the wrong track.
    setNowPlaying((current) =>
      current && current.id === track.id ? { ...current, artwork: uri } : current
    );
  } catch (err) {
    // Non-critical - file just stays without art this session.
  }
}

export default function App() {
  // Every backend call now needs a real JWT (api-cache and messenger both
  // reject anonymous requests outright) - so this is a hard gate, not an
  // optional login screen. "Continue as Guest" inside LoginScreen still
  // ends up here with a real token, the user just never sees a form.
  const [authUser, setAuthUser] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    getStoredAuth().then((user) => {
      setAuthUser(user);
      setAuthResolved(true);
    });
  }, []);

  const handleSignOut = async () => {
    await clearStoredAuth();
    setAuthUser(null);
    // authResolved stays true - authUser being null re-renders straight
    // into the login gate below, no extra "resolving" flash needed.
  };

  const [activeNav, setActiveNav] = useState("home");
  const [activeDrawerScreen, setActiveDrawerScreen] = useState(null); // e.g. "news"
  const [selectedShareFriend, setSelectedShareFriend] = useState(null); // friend for ShareThreadScreen
  const [nowPlaying, setNowPlaying] = useState(null); // track object

  // Push the current track to the home screen widget whenever it changes -
  // no-op if the widget isn't placed on any home screen.
  const [updateInfo, setUpdateInfo] = useState(null); // set once if /api/ota/check finds a newer version

  // Silent launch-time check against the custom OTA backend (ota.py) - not
  // expo-updates, since this app ships whole-APK replacements with its own
  // changelog/mandatory flag rather than JS-bundle-only patches. A failed
  // check (offline, backend down) is swallowed - it should never block
  // someone from using the app.
  useEffect(() => {
    if (!authUser) return; // wait for sign-in - checkForUpdate() needs a real JWT now
    checkForUpdate()
      .then((result) => {
        if (result.update_available) setUpdateInfo(result);
      })
      .catch(() => {});
  }, [authUser]);

  // Silent, best-effort "Made for you" playlist generation on launch.
  // Throttled to once per 24h so it doesn't spam duplicate playlists
  // every time the app opens. Any failure (no history yet, offline,
  // backend error) is swallowed - this should never block or nag.
  useEffect(() => {
    const AI_PLAYLIST_GEN_KEY = "b24music:aiPlaylistLastGen";
    const FIRST_SEEN_KEY = "b24music:firstSeenAt";
    const DELAY_MS = 3 * 24 * 60 * 60 * 1000; // wait 3 days before the first auto-gen
    const MIN_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // then re-gen at most every 3 days

    (async () => {
      try {
        let firstSeen = await AsyncStorage.getItem(FIRST_SEEN_KEY);
        if (!firstSeen) {
          firstSeen = String(Date.now());
          await AsyncStorage.setItem(FIRST_SEEN_KEY, firstSeen);
          return; // brand new install - nothing to base a taste profile on yet
        }
        if (Date.now() - Number(firstSeen) < DELAY_MS) return;

        const last = await AsyncStorage.getItem(AI_PLAYLIST_GEN_KEY);
        if (last && Date.now() - Number(last) < MIN_INTERVAL_MS) return;

        await generateAIPlaylist();
        await AsyncStorage.setItem(AI_PLAYLIST_GEN_KEY, String(Date.now()));
      } catch (err) {
        // No network, not enough listening history, backend error - fine,
        // just try again next launch after the throttle window.
      }
    })();
  }, []);

  // Requests notification permission and, once signed in, registers the
  // resulting Expo push token with the backend so shares/send can actually
  // reach this device. Waits on authUser since the token has to be
  // associated with a real user id.
  useEffect(() => {
    if (!authUser?.id) return;
    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;
      registerPushToken(authUser.id, token).catch((e) =>
        console.warn("[push] failed to register token with backend:", e.message)
      );
    });
  }, [authUser?.id]);

  // Tapping a download-progress/download-complete notification opens the
  // Library tab. Doesn't jump to the Downloads sub-tab specifically yet -
  // LibraryScreen manages that internally - but gets the user to the right
  // screen with one tap, which is what we're testing first.
  useEffect(() => {
    const openLibraryFromDownloadNotification = () => {
      setActiveDrawerScreen(null);
      setSelectedShareFriend(null);
      setActiveNav("library");
    };

    // Cold-start case: app was fully closed, user tapped the notification
    // to relaunch it.
    getLastDownloadNotificationKeyAsync().then((key) => {
      if (key) openLibraryFromDownloadNotification();
    });

    // Warm case: app already running (foreground or backgrounded).
    const subscription = addDownloadNotificationResponseListener(() => {
      openLibraryFromDownloadNotification();
    });
    return () => subscription.remove();
  }, []);

  // Tapping a "friend sent you a song" push opens that friend's share
  // thread directly. Looks the friend up from the accepted-friends list
  // by id rather than trusting anything else in the push payload, in case
  // the friendship changed between send and tap. Falls back to the plain
  // Inbox list if the friend can't be found for any reason.
  useEffect(() => {
    const openShareThreadFor = async (fromUserId) => {
      if (!authUser?.id || !fromUserId) return;
      setSelectedShareFriend(null);
      setActiveDrawerScreen("inbox");
      try {
        const friends = await listFriends(authUser.id);
        const friend = friends.find((f) => f.id === fromUserId);
        if (friend) setSelectedShareFriend(friend);
      } catch (e) {
        // Plain Inbox list is still a fine fallback if this lookup fails.
      }
    };

    getLastShareFromUserIdAsync().then((fromUserId) => {
      if (fromUserId) openShareThreadFor(fromUserId);
    });

    const subscription = addShareNotificationResponseListener((fromUserId) => {
      openShareThreadFor(fromUserId);
    });
    return () => subscription.remove();
  }, [authUser?.id]);

  // Turns on the lock-screen / notification media session once, at launch.
  // Separate from registerPlaybackControls below, which re-fires on every
  // engine change to push fresh state - this just needs to run once.
  useEffect(() => {
    initMediaControls();
  }, []);

  const [playerExpanded, setPlayerExpanded] = useState(false); // State A vs State B
  const [shuffleOn, setShuffleOn] = useState(false);

  // The queue nowPlaying was picked from, plus its index in that queue.
  // Whatever screen starts playback (Home's trending row, Library, a search
  // result list, etc.) hands over the list it was showing so prev/next in
  // the mini nav and the expanded PlayerCard have something real to skip
  // through - not just the single track that happened to be tapped.
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const originalQueueRef = useRef(null);

  // Single playback engine instance, lifted here so both the mini
  // disc/video-box (in AppShell) and the expanded Player/full-screen video
  // share the exact same live player - never two separate instances of the
  // same track fighting each other.
  const engine = usePlaybackEngine(nowPlaying);

  // Auto-advance once the current track finishes. lastAutoAdvanceIndex
  // guards against firing twice for the same finish event (didJustFinish
  // can stay true for more than one render before the next track loads).
  const lastAutoAdvanceIndex = useRef(null);
  useEffect(() => {
    if (engine.didJustFinish) {
      if (lastAutoAdvanceIndex.current !== queueIndex) {
        lastAutoAdvanceIndex.current = queueIndex;
        nextTrack();
      }
    } else {
      lastAutoAdvanceIndex.current = null;
    }
  }, [engine.didJustFinish, queueIndex]);

  const goToDrawerScreen = (key) => setActiveDrawerScreen(key);
  const backFromDrawerScreen = () => {
    setActiveDrawerScreen(null);
    setSelectedShareFriend(null);
  };

  const shuffleWithFirst = (list, first) => {
    const rest = list.filter((t) => t !== first);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [first, ...rest];
  };

  const toggleShuffle = (on) => {
    setShuffleOn(on);
    if (!queue.length) return;
    const cur = queue[queueIndex];
    if (on) {
      if (!originalQueueRef.current) originalQueueRef.current = queue;
      setQueue(shuffleWithFirst(queue, cur));
      setQueueIndex(0);
    } else {
      const orig = originalQueueRef.current || queue;
      const i = orig.findIndex((t) => cur && t.provider === cur.provider && t.id === cur.id);
      setQueue(orig);
      setQueueIndex(i < 0 ? 0 : i);
    }
  };

  // Tapping a song in Up Next jumps within the queue; anything else starts fresh.
  const playFromQueue = (track, src) => {
    if (src && src.length) return playTrack(track, src);
    const i = queue.findIndex((t) => t.provider === track.provider && t.id === track.id);
    if (i >= 0) return playAtIndex(i);
    return playTrack(track);
  };

  // sourceQueue is optional - pass the list a track was tapped from (e.g.
  // Home's displayedTracks) so prev/next can walk it. Omit it (e.g. a
  // related-track pick inside the expanded player) and it starts a fresh
  // single-track queue of just that one track.
  const playTrack = (track, sourceQueue) => {
    if (!track) return;
    const nextQueue = sourceQueue && sourceQueue.length ? sourceQueue : [track];
    const idx = nextQueue.findIndex(
      (t) => t.provider === track.provider && t.id === track.id
    );
    originalQueueRef.current = nextQueue;
    const startIdx = idx === -1 ? 0 : idx;
    if (shuffleOn && nextQueue.length > 1) {
      setQueue(shuffleWithFirst(nextQueue, nextQueue[startIdx]));
      setQueueIndex(0);
    } else {
      setQueue(nextQueue);
      setQueueIndex(startIdx);
    }
    setNowPlaying(track);
    resolveDeviceArtwork(track, setNowPlaying);
    // Video tracks jump straight to full-screen per spec; audio tracks stay
    // collapsed to the mini disc until the user taps it.
    if (track?.type === "video") {
      setPlayerExpanded(true);
    }
  };

  // Play whatever's at a given queue index without touching the queue
  // itself - used by prev/next so they don't reset queue context every time.
  const playAtIndex = (idx) => {
    const track = queue[idx];
    if (!track) return;
    setQueueIndex(idx);
    setNowPlaying(track);
    resolveDeviceArtwork(track, setNowPlaying);
    if (track?.type === "video") {
      setPlayerExpanded(true);
    }
  };

  // Wrap around at both ends, like most music players. No-op if there's
  // no queue yet (nothing has been played).
  const nextTrack = () => {
    if (!queue.length) return;
    if (shuffleOn && queue.length > 1) {
      let idx;
      do {
        idx = Math.floor(Math.random() * queue.length);
      } while (idx === queueIndex);
      playAtIndex(idx);
    } else {
      playAtIndex((queueIndex + 1) % queue.length);
    }
  };
  const prevTrack = () => {
    if (!queue.length) return;
    playAtIndex((queueIndex - 1 + queue.length) % queue.length);
  };

  // Expose live playback controls to the home screen widget's click
  // handler, which runs outside the normal React tree (see
  // playbackBridge.js and widget-task-handler.js).
  // Lyrics for the widget's subtitle line - separate fetch from
  // PlayerCard.js's own (see lyricsClient.js), sharing the same cache key.
  const [widgetLyrics, setWidgetLyrics] = useState([]);
  const [widgetLyricsReady, setWidgetLyricsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setWidgetLyrics([]);
    setWidgetLyricsReady(false);
    if (!nowPlaying?.artist || !nowPlaying?.title) return;
    fetchLyrics(nowPlaying).then((data) => {
      if (cancelled) return;
      setWidgetLyrics(data.lyrics || []);
      setWidgetLyricsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [nowPlaying?.artist, nowPlaying?.title]);

  // null while loading (widget shows artist); "Lyrics not found" once
  // loaded with nothing; the active synced line once reached; null before
  // the first synced line (falls back to artist too).
  const widgetLyricIdx = activeLyricIndex(widgetLyrics, engine.position);
  const currentLyricLine = !widgetLyricsReady
    ? null
    : widgetLyrics.length === 0
    ? "Lyrics not found"
    : widgetLyricIdx >= 0
    ? widgetLyrics[widgetLyricIdx]?.text || null
    : null;

  // Expose live playback controls to the home screen widget's click
  // handler, which runs outside the normal React tree (see
  // playbackBridge.js and widget-task-handler.js).
  useEffect(() => {
    registerPlaybackControls({
      toggle: () => engine.toggle(),
      next: nextTrack,
    playTrack: (t, q) => playTrack(t, q),
      prev: prevTrack,
      getState: () => ({
        isPlaying: engine.isPlaying,
        track: nowPlaying,
        position: engine.position,
        duration: engine.duration,
        lyricLine: currentLyricLine,
      }),
    });
  }, [engine.isPlaying, engine.position, engine.duration, nowPlaying, queue, queueIndex, currentLyricLine]);

  // Push the current track/playback state to the home-screen widget.
  // updateNowPlayingWidget() throttles the actual native push internally,
  // so calling this on every position tick is safe.
  useEffect(() => {
    updateNowPlayingWidget(nowPlaying, {
      isPlaying: engine.isPlaying,
      position: engine.position,
      duration: engine.duration,
      lyricLine: currentLyricLine,
    });
  }, [nowPlaying, engine.isPlaying, engine.position, engine.duration, currentLyricLine]);

  const expandPlayer = () => setPlayerExpanded(true);
  const collapsePlayer = () => setPlayerExpanded(false);

  let content;
  if (activeDrawerScreen === "news") {
    content = <NewsScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "rest") {
    content = <RestScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "art") {
    content = <ArtScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "weather") {
    content = <WeatherScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "trivia") {
    content = <TriviaScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "jokes") {
    content = <JokesScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "food") {
    content = <FoodScreen onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "pasteUrl") {
    content = <PasteUrlScreen onTrackPress={playTrack} onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "recent") {
    content = <RecentScreen onTrackPress={playTrack} onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "mostPlayed") {
    content = <MostPlayedScreen onTrackPress={playTrack} onBack={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "aiChat") {
    content = <AIChatScreen onClose={backFromDrawerScreen} />;
  } else if (activeDrawerScreen === "inbox") {
    content = selectedShareFriend ? (
      <ShareThreadScreen
        friend={selectedShareFriend}
        onBack={() => setSelectedShareFriend(null)}
        onTrackPress={(item) =>
          /* app_track_mapping_fix */
          playTrack({
            id: item.item_id,
            provider: item.item_meta?.provider,
            title: item.item_meta?.title,
            artist: item.item_meta?.artist,
            artwork: item.item_meta?.artwork_url,
            duration: item.item_meta?.duration || 0,
          })
        }
      />
    ) : (
      <InboxScreen
        onFriendPress={(friend) => setSelectedShareFriend(friend)}
        onBack={backFromDrawerScreen}
      />
    );
  } else if (activeNav === "home") {
    content = (
      <HomeScreen
        onTrackPress={playTrack}
        onDrawerTilePress={goToDrawerScreen}
        onSearchPress={() => setActiveNav("search")}
        onPasteLinkPress={() => goToDrawerScreen("pasteUrl")}
        onRecentPress={() => goToDrawerScreen("recent")}
        onAIChatPress={() => goToDrawerScreen("aiChat")}
        onInboxPress={() => goToDrawerScreen("inbox")}
        onSettingsPress={() => setActiveNav("settings")}
        nowPlaying={nowPlaying}
        engine={engine}
      />
    );
  } else if (activeNav === "library") {
    content = <LibraryScreen onTrackPress={playTrack} onSearchPress={() => setActiveNav("search")} onMostPlayedPress={() => goToDrawerScreen("mostPlayed")} />;
  } else if (activeNav === "search") {
    content = <SearchScreen onTrackPress={playTrack} />;
  } else if (activeNav === "settings") {
    content = (
      <SettingsScreen
        authUser={authUser}
        onSignOutPress={handleSignOut}
        onProfileUpdate={async (patch) => {
          const updated = await updateStoredAuth(patch);
          if (updated) setAuthUser(updated);
        }}
      />
    );
  }

  const isVideo = nowPlaying?.type === "video";

  if (!authResolved) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b3d4c" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!authUser) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LoginScreen onAuthenticated={(user) => setAuthUser(user)} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DownloadsProvider>
        <AppShell
          activeNav={activeNav}
          onNavPress={setActiveNav}
          nowPlaying={nowPlaying}
          engine={engine}
          playerExpanded={playerExpanded}
          onExpandPress={expandPlayer}
          onCollapsePress={collapsePlayer}
          onSkipNext={nextTrack}
          onSkipPrev={prevTrack}
        >
          {content}
        </AppShell>

      {playerExpanded && nowPlaying && !isVideo && (
        <PlayerCard
          track={nowPlaying}
          engine={engine}
          onCollapse={collapsePlayer}
          onNext={nextTrack}
          onPrev={prevTrack}
          onPlayTrack={playFromQueue}
          shuffleOn={shuffleOn}
          onShuffleToggle={toggleShuffle}
          queue={queue.length ? [...queue.slice(queueIndex + 1), ...queue.slice(0, Math.max(queueIndex, 0))] : []}
          queueIndex={-1}
        />
      )}
      {playerExpanded && nowPlaying && isVideo && (
        <FullscreenVideoPlayer
          track={nowPlaying}
          engine={engine}
          onClose={collapsePlayer}
          onNext={nextTrack}
          onPrev={prevTrack}
        />
      )}

      {updateInfo && (
        <UpdatePrompt
          update={updateInfo}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

      <StatusBar style="light" />
    </DownloadsProvider>
    </GestureHandlerRootView>
  );
}
