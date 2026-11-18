import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/HomeScreen";
import LibraryScreen from "../screens/library/LibraryScreen";
import SearchScreen from "../screens/SearchScreen";

const Tab = createBottomTabNavigator();

const ACCENT = "#FF7A3D";
const SURFACE = "#171412";
const MUTED = "#A8A196";

export default function MainTabs({
  playTrack,
  goToDrawerScreen,
  nowPlaying,
  engine,
  onSearchPress,
  onMostPlayedPress,
}) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 64,
          paddingBottom: 8,
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
        lazy: false,
        unmountOnBlur: false,
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

      <Tab.Screen name="Library">
        {() => (
          <LibraryScreen
            onTrackPress={playTrack}
            onSearchPress={onSearchPress}
            onMostPlayedPress={onMostPlayedPress}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Search">
        {() => <SearchScreen onTrackPress={playTrack} />}
      </Tab.Screen>

      <Tab.Screen name="Videos">
        {() => (
          <LibraryScreen
            section="Videos"
            onTrackPress={playTrack}
            onSearchPress={onSearchPress}
            onMostPlayedPress={onMostPlayedPress}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Downloads">
        {() => (
          <LibraryScreen
            section="Downloads"
            onTrackPress={playTrack}
            onSearchPress={onSearchPress}
            onMostPlayedPress={onMostPlayedPress}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
