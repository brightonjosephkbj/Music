/**
 * Copyright (c) Double Symmetry GmbH
 * Commercial use requires a license. See https://rntp.dev/pricing
 */

import type { TurboModule } from 'react-native';
import { Platform, TurboModuleRegistry } from 'react-native';
import type { UnsafeObject } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  // Setup
  setupPlayer(config: UnsafeObject): void;

  // Playback
  play(): void;
  pause(): void;
  stop(): void;
  seekTo(position: number): void;
  seekToLiveEdge(): void;
  seekBy(offset: number): void;
  skipToNext(): void;
  skipToPrevious(): void;
  skipToIndex(index: number): void;
  retry(): void;
  clearCache(): void;
  setPlaybackSpeed(speed: number): void;
  setVolume(volume: number): void;

  // Queue - set
  setMediaItem(mediaItem: UnsafeObject): void;
  setMediaItems(
    mediaItems: ReadonlyArray<UnsafeObject>,
    startIndex: number
  ): void;

  // Queue - add/insert
  addMediaItem(mediaItem: UnsafeObject): void;
  addMediaItems(mediaItems: ReadonlyArray<UnsafeObject>): void;
  insertMediaItem(index: number, mediaItem: UnsafeObject): void;
  insertMediaItems(
    index: number,
    mediaItems: ReadonlyArray<UnsafeObject>
  ): void;

  // Queue - remove
  removeMediaItem(index: number): void;
  removeMediaItems(fromIndex: number, toIndex: number): void;
  clear(): void;

  // Queue - replace & reorder
  replaceMediaItem(index: number, mediaItem: UnsafeObject): void;
  moveMediaItem(fromIndex: number, toIndex: number): void;

  // Queue - update metadata
  updateMetadata(index: number, metadata: UnsafeObject): void;

  // State getters (sync)
  getPlaybackState(): string;
  isPlaying(): boolean;
  getProgress(): UnsafeObject;
  getPlaybackSpeed(): number;
  getVolume(): number;
  getActiveMediaItem(): UnsafeObject | null;
  getActiveMediaItemIndex(): number | null;
  getQueue(): ReadonlyArray<UnsafeObject>;
  getRepeatMode(): string;
  isShuffleEnabled(): boolean;

  // Player options
  setCommands(commands: UnsafeObject): void;
  setRepeatMode(mode: string): void;
  setShuffleEnabled(enabled: boolean): void;

  // Browse tree (Android Auto / media browsers)
  setBrowseTree(categories: ReadonlyArray<UnsafeObject>): void;

  // Progress Sync
  updateProgressSyncHeaders(headers: UnsafeObject): void;

  // Preloading
  preload(item: UnsafeObject, duration: number): void;
  cancelPreload(item: UnsafeObject): void;

  // Sleep Timer
  sleepAfterTime(seconds: number, fadeOutSeconds: number): void;
  sleepAfterMediaItemAtIndex(index: number): void;
  getSleepTimer(): UnsafeObject | null;
  cancelSleepTimer(): void;

  // Destroy
  destroy(): void;

  // RCTEventEmitter methods
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
}

function getNativeModule(): Spec {
  try {
    return TurboModuleRegistry.getEnforcing<Spec>('TrackPlayer');
  } catch (error) {
    if (Platform.OS === 'web') {
      throw new Error(
        '@rntp/player: the native TurboModule was requested on web. Your bundler ' +
          "isn't resolving `.web.ts` platform extensions, so it picked the native " +
          'module instead of the web implementation. Configure resolve extensions ' +
          "(e.g. ['.web.tsx', '.web.ts', '.web.js', ...]) — see the web installation docs."
      );
    }
    throw error;
  }
}

export default getNativeModule();
