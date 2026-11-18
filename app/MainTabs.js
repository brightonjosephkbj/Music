import React, { useCallback, useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "../screens/HomeScreen";
import LibraryScreen from "../screens/library/LibraryScreen";
import SearchScreen from "../screens/SearchScreen";

const Tab = createBottomTabNavigator();

const ACCENT = "#FF7A3D";
const SURFACE = "#171412";
const MUTED = "#A8A196";

// Tab bar content height (without system inset). AppShell uses the same value
// to float the mini player exactly above the bar.
export const TAB_ROW_HEIGHT = 52;
export const TAB_BOTTOM_MIN = 4;

export default function MainTabs({
  playTrack,
  goToDrawerScreen,
  nowPlaying,
  engine,
  onSearchPress,
  onMostPlayedPress,
  onTabPress,
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, TAB_BOTTOM_MIN);

  const goSearch = useCallback(() => onSearchPress && onSearchPress(), [onSearchPress]);
  const libraryEl = useMemo(() => (
    <LibraryScreen onTrackPress={playTrack} onSearchPress={goSearch} onMostPlayedPress={onMostPlayedPress} />
  ), [playTrack, goSearch, onMostPlayedPress]);
  const searchEl = useMemo(() => <SearchScreen onTrackPress={playTrack} />, [playTrack]);
  const videosEl = useMemo(() => (
    <LibraryScreen section="Videos" onTrackPress={playTrack} onSearchPress={goSearch} onMostPlayedPress={onMostPlayedPress} />
  ), [playTrack, goSearch, onMostPlayedPress]);
  const downloadsEl = useMemo(() => (
    <LibraryScreen section="Downloads" onTrackPress={playTrack} onSearchPress={goSearch} onMostPlayedPress={onMostPlayedPress} />
  ), [playTrack, goSearch, onMostPlayedPress]);

  return (
    <Tab.Navigator
      screenListeners={{ tabPress: () => { onTabPress && onTabPress(); } }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: "rgba(255,255,255,0.08)",
          height: TAB_ROW_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: focused ? "home" : "home-outline",
            Library: focused ? "albums" : "albums-outline",
            Search: focused ? "search" : "search-outline",
            Videos: focused ? "videocam" : "videocam-outline",
            Downloads: focused ? "download" : "download-outline",
          };
          return (
            <Ionicons
              name={icons[route.name] || "ellipse"}
              size={size}
              color={color}
            />
          );
        },
        lazy: true,
        freezeOnBlur: true,
        animation: "shift",
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home">
        {() => (
          <HomeScreen
            onTrackPress={playTrack}
            onDrawerTilePress={goToDrawerScreen}
            onSearchPress={onSearchPress}
            onPasteLinkPress={() => goToDrawerScreen("pasteUrl")}
            onRecentPress={() => goToDrawerScreen("recent")}
            onAIChatPress={() => goToDrawerScreen("aiChat")}
            onInboxPress={() => goToDrawerScreen("inbox")}
            onSettingsPress={() => goToDrawerScreen("settings")}
            nowPlaying={nowPlaying}
            engine={engine}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Library">{() => libraryEl}</Tab.Screen>
      <Tab.Screen name="Search">{() => searchEl}</Tab.Screen>
      <Tab.Screen name="Videos">{() => videosEl}</Tab.Screen>
      <Tab.Screen name="Downloads">{() => downloadsEl}</Tab.Screen>
    </Tab.Navigator>
  );
}
