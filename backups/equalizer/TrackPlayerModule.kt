/*
 * Copyright (c) Double Symmetry GmbH
 * Commercial use requires a license. See https://rntp.dev/pricing
 */

package com.doublesymmetry.trackplayer

import android.content.ComponentName
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.google.common.util.concurrent.MoreExecutors
import com.doublesymmetry.trackplayer.extensions.emitEvent
import androidx.media3.datasource.cache.ContentMetadata
import com.doublesymmetry.trackplayer.models.TrackPlayerMediaItem
import com.doublesymmetry.trackplayer.models.BrowseTree
import com.doublesymmetry.trackplayer.models.MediaHeaders
import com.doublesymmetry.trackplayer.models.IsPlayingChangedEvent
import com.doublesymmetry.trackplayer.models.MediaItemTransitionEvent
import com.doublesymmetry.trackplayer.models.MediaMetadataChangedEvent
import com.doublesymmetry.trackplayer.models.PlaybackErrorEvent
import com.doublesymmetry.trackplayer.models.PlaybackStateChangedEvent
import com.doublesymmetry.trackplayer.models.QueueChangedEvent
import com.doublesymmetry.trackplayer.models.PlayerConfig
import com.doublesymmetry.trackplayer.models.PlaybackProgressUpdatedEvent
import org.json.JSONObject

class TrackPlayerModule internal constructor(private val context: ReactApplicationContext) : TrackPlayerSpec(context), Player.Listener {

  // region Properties

  private val controller = MainThreadMediaController()
  private var lastMediaMetadata: MediaMetadataChangedEvent? = null

  // endregion

  // region ReactModule

  override fun getName(): String {
    return NAME
  }

  // endregion

  // region Setup

  @ReactMethod
  override fun setupPlayer(map: ReadableMap) {
    val config = PlayerConfig.fromReadableMap(map)
    config.store(context)
    controller.run {
      val sessionToken = SessionToken(context, ComponentName(context, TrackPlayerPlaybackService::class.java))
      val controllerFuture = MediaController.Builder(context, sessionToken).buildAsync()
      controllerFuture.addListener(
        {
          val mc = controllerFuture.get()
          mc.addListener(this)
          controller.set(mc)
          mc.sendCustomCommand(
            SessionCommand(TrackPlayerPlaybackService.COMMAND_UPDATE_BROWSE_TREE, Bundle.EMPTY),
            Bundle.EMPTY
          )
        },
        MoreExecutors.directExecutor()
      )
    }
  }

  // endregion

  // region Playback

  @ReactMethod
  override fun play() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_PLAY, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun seekToLiveEdge() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SEEK_TO_LIVE_EDGE, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun pause() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_PAUSE, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun stop() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_STOP, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun seekTo(position: Double) {
    controller.run { mc ->
      val args = Bundle().apply { putLong("positionMs", (position * 1000).toLong()) }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SEEK_TO, Bundle.EMPTY),
        args
      )
    }
  }

  @ReactMethod
  override fun seekBy(offset: Double) {
    controller.run { mc ->
      val args = Bundle().apply { putDouble("offsetSeconds", offset) }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SEEK_BY, Bundle.EMPTY),
        args
      )
    }
  }

  @ReactMethod
  override fun skipToNext() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SEEK_TO_NEXT, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun skipToPrevious() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SEEK_TO_PREVIOUS, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun skipToIndex(index: Double) {
    controller.run { mc ->
      mc ?: return@run
      val idx = index.toInt()
      if (idx in 0 until mc.mediaItemCount) {
        mc.seekTo(idx, 0)
      }
    }
  }

  @ReactMethod
  override fun retry() {
    controller.run { it?.prepare() }
  }

  @ReactMethod
  override fun clearCache() {
    java.util.concurrent.Executors.newSingleThreadExecutor().execute {
      TrackPlayerPlaybackService.clearCache()
    }
  }

  @ReactMethod
  override fun setPlaybackSpeed(speed: Double) {
    controller.run { it?.setPlaybackSpeed(speed.toFloat()) }
  }

  @ReactMethod
  override fun setVolume(volume: Double) {
    controller.run { it?.volume = volume.toFloat().coerceIn(0f, 1f) }
  }

  // endregion

  // region Queue - Set

  @ReactMethod
  override fun setMediaItem(map: ReadableMap) {
    val trackPlayerItem = TrackPlayerMediaItem.fromReadableMap(map)
    controller.run { mc ->
      mc?.setMediaItem(trackPlayerItem.asMediaItem(context))
      mc?.prepare()
    }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun setMediaItems(data: ReadableArray, startIndex: Double) {
    val mediaItems = readableArrayToMediaItems(data)
    controller.run { mc ->
      mc?.setMediaItems(mediaItems, startIndex.toInt(), 0)
      mc?.prepare()
    }
    context.emitEvent(QueueChangedEvent())
  }

  // endregion

  // region Queue - Add/Insert

  @ReactMethod
  override fun addMediaItem(map: ReadableMap) {
    val mediaItem = TrackPlayerMediaItem.fromReadableMap(map).asMediaItem(context)
    controller.run { it?.addMediaItem(mediaItem) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun addMediaItems(data: ReadableArray) {
    val mediaItems = readableArrayToMediaItems(data)
    controller.run { it?.addMediaItems(mediaItems) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun insertMediaItem(index: Double, map: ReadableMap) {
    val mediaItem = TrackPlayerMediaItem.fromReadableMap(map).asMediaItem(context)
    controller.run { it?.addMediaItem(index.toInt(), mediaItem) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun insertMediaItems(index: Double, data: ReadableArray) {
    val mediaItems = readableArrayToMediaItems(data)
    controller.run { it?.addMediaItems(index.toInt(), mediaItems) }
    context.emitEvent(QueueChangedEvent())
  }

  // endregion

  // region Queue - Remove

  @ReactMethod
  override fun removeMediaItem(index: Double) {
    controller.run { it?.removeMediaItem(index.toInt()) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun removeMediaItems(fromIndex: Double, toIndex: Double) {
    controller.run { it?.removeMediaItems(fromIndex.toInt(), toIndex.toInt()) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun clear() {
    controller.run { it?.clearMediaItems() }
    context.emitEvent(QueueChangedEvent())
  }

  // endregion

  // region Queue - Replace & Reorder

  @ReactMethod
  override fun replaceMediaItem(index: Double, map: ReadableMap) {
    val mediaItem = TrackPlayerMediaItem.fromReadableMap(map).asMediaItem(context)
    controller.run { it?.replaceMediaItem(index.toInt(), mediaItem) }
    context.emitEvent(QueueChangedEvent())
  }

  @ReactMethod
  override fun moveMediaItem(fromIndex: Double, toIndex: Double) {
    controller.run { it?.moveMediaItem(fromIndex.toInt(), toIndex.toInt()) }
    context.emitEvent(QueueChangedEvent())
  }

  // endregion

  // region Queue - Update Metadata

  @ReactMethod
  override fun updateMetadata(index: Double, metadata: ReadableMap) {
    controller.run { mc ->
      mc ?: return@run
      val idx = index.toInt()
      if (idx !in 0 until mc.mediaItemCount) return@run

      val existing = mc.getMediaItemAt(idx)
      val oldMeta = existing.mediaMetadata

      val newMeta = MediaMetadata.Builder()
        .populate(oldMeta)
        .apply {
          if (metadata.hasKey("title")) setTitle(metadata.getString("title"))
          if (metadata.hasKey("artist")) setArtist(metadata.getString("artist"))
          if (metadata.hasKey("albumTitle")) setAlbumTitle(metadata.getString("albumTitle"))
          if (metadata.hasKey("artworkUrl")) {
            val art = metadata.getString("artworkUrl")
            setArtworkUri(art?.let { android.net.Uri.parse(it) })
          }
        }
        .build()

      val updated = existing.buildUpon()
        .setMediaMetadata(newMeta)
        .build()

      mc.replaceMediaItem(idx, updated)
    }
  }

  // endregion

  // region State Getters (sync)

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getPlaybackState(): String {
    return controller.sync { mc ->
      if (mc == null) return@sync "idle"
      when (mc.playbackState) {
        Player.STATE_IDLE -> "idle"
        Player.STATE_BUFFERING -> "buffering"
        Player.STATE_READY -> "ready"
        Player.STATE_ENDED -> "ended"
        else -> "idle"
      }
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun isPlaying(): Boolean {
    return controller.sync { it?.isPlaying ?: false }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getProgress(): WritableMap {
    return controller.sync { mc ->
      val map = Arguments.createMap()
      if (mc == null) {
        map.putDouble("position", 0.0)
        map.putDouble("duration", 0.0)
        map.putDouble("buffered", 0.0)
        map.putDouble("cached", 0.0)
      } else {
        val durationMs = mc.duration
        map.putDouble("position", mc.currentPosition / 1000.0)
        map.putDouble("duration", durationMs / 1000.0)
        map.putDouble("buffered", mc.bufferedPosition / 1000.0)

        val cache = TrackPlayerPlaybackService.sharedCache
        val uri = mc.currentMediaItem?.localConfiguration?.uri?.toString()
        if (cache != null && uri != null && durationMs > 0) {
          val contentLength = ContentMetadata.getContentLength(cache.getContentMetadata(uri))
          if (contentLength > 0) {
            val cachedBytes = cache.getCachedBytes(uri, 0, contentLength)
            map.putDouble("cached", (cachedBytes.toDouble() / contentLength) * (durationMs / 1000.0))
          } else {
            map.putDouble("cached", 0.0)
          }
        } else {
          map.putDouble("cached", 0.0)
        }
      }
      map
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getPlaybackSpeed(): Double {
    return controller.sync { it?.playbackParameters?.speed?.toDouble() ?: 1.0 }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getVolume(): Double {
    return controller.sync { it?.volume?.toDouble() ?: 1.0 }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getActiveMediaItem(): WritableMap? {
    return controller.sync { mc ->
      val currentItem = mc?.currentMediaItem ?: return@sync null
      TrackPlayerMediaItem.fromMediaItem(currentItem).toWritableMap()
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getActiveMediaItemIndex(): Double? {
    return controller.sync { mc ->
      if (mc == null || mc.mediaItemCount == 0) null
      else mc.currentMediaItemIndex.toDouble()
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getQueue(): WritableArray {
    return controller.sync { mc ->
      val queue = Arguments.createArray()
      if (mc != null) {
        for (i in 0 until mc.mediaItemCount) {
          queue.pushMap(TrackPlayerMediaItem.fromMediaItem(mc.getMediaItemAt(i)).toWritableMap())
        }
      }
      queue
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getRepeatMode(): String {
    return controller.sync { mc ->
      when (mc?.repeatMode) {
        Player.REPEAT_MODE_ONE -> "one"
        Player.REPEAT_MODE_ALL -> "all"
        else -> "off"
      }
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun isShuffleEnabled(): Boolean {
    return controller.sync { it?.shuffleModeEnabled ?: false }
  }

  // endregion

  // region Player Options

  @ReactMethod
  override fun setCommands(commands: ReadableMap) {
    val currentConfig = PlayerConfig().load(context)
    val updatedConfig = currentConfig.withCommands(commands)
    updatedConfig.store(context)

    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_UPDATE_COMMANDS, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  @ReactMethod
  override fun setRepeatMode(mode: String) {
    controller.run { mc ->
      mc?.repeatMode = when (mode) {
        "one" -> Player.REPEAT_MODE_ONE
        "all" -> Player.REPEAT_MODE_ALL
        else -> Player.REPEAT_MODE_OFF
      }
    }
  }

  @ReactMethod
  override fun setShuffleEnabled(enabled: Boolean) {
    controller.run { it?.shuffleModeEnabled = enabled }
  }

  @ReactMethod
  override fun setBrowseTree(categories: ReadableArray) {
    val browseTree = BrowseTree.fromReadableArray(categories)
    browseTree.store(context)

    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_UPDATE_BROWSE_TREE, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  // endregion

  // region Progress Sync

  @ReactMethod
  override fun updateProgressSyncHeaders(headers: ReadableMap) {
    val currentConfig = PlayerConfig().load(context)
    val newHeaders = mutableMapOf<String, String>()
    val iterator = headers.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      headers.getString(key)?.let { newHeaders[key] = it }
    }
    val updatedConfig = currentConfig.copy(progressSyncHttpHeaders = newHeaders)
    updatedConfig.store(context)

    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_UPDATE_PROGRESS_SYNC_HEADERS, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  // endregion

  // region Sleep Timer

  @ReactMethod
  override fun sleepAfterTime(seconds: Double, fadeOutSeconds: Double) {
    controller.run { mc ->
      val args = Bundle().apply {
        putDouble("seconds", seconds)
        putDouble("fadeOutSeconds", fadeOutSeconds)
      }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SLEEP_AFTER_TIME, Bundle.EMPTY),
        args
      )
    }
  }

  @ReactMethod
  override fun sleepAfterMediaItemAtIndex(index: Double) {
    controller.run { mc ->
      val args = Bundle().apply { putInt("index", index.toInt()) }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_SLEEP_AFTER_MEDIA_ITEM, Bundle.EMPTY),
        args
      )
    }
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun getSleepTimer(): WritableMap? {
    val prefs = context.getSharedPreferences(PLAYER_PREFS_NAME, android.content.Context.MODE_PRIVATE)
    val jsonStr = prefs.getString(TrackPlayerPlaybackService.SLEEP_TIMER_STATE_KEY, null) ?: return null
    return try {
      val json = JSONObject(jsonStr)
      val type = json.getString("type")
      val map = Arguments.createMap()
      map.putString("type", type)
      if (type == "time") {
        map.putDouble("remainingSeconds", json.getDouble("remainingSeconds"))
        map.putDouble("fadeOutSeconds", json.getDouble("fadeOutSeconds"))
      } else {
        map.putInt("index", json.getInt("index"))
      }
      map
    } catch (e: Exception) {
      null
    }
  }

  @ReactMethod
  override fun cancelSleepTimer() {
    controller.run { mc ->
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_CANCEL_SLEEP_TIMER, Bundle.EMPTY),
        Bundle.EMPTY
      )
    }
  }

  // endregion

  // region Preloading

  @ReactMethod
  override fun preload(item: ReadableMap, duration: Double) {
    val url = extractUrl(item) ?: return
    controller.run { mc ->
      val args = Bundle().apply { putString("uri", url) }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_PRELOAD, Bundle.EMPTY),
        args
      )
    }
  }

  @ReactMethod
  override fun cancelPreload(item: ReadableMap) {
    val url = extractUrl(item) ?: return
    controller.run { mc ->
      val args = Bundle().apply { putString("uri", url) }
      mc?.sendCustomCommand(
        SessionCommand(TrackPlayerPlaybackService.COMMAND_CANCEL_PRELOAD, Bundle.EMPTY),
        args
      )
    }
  }

  private fun extractUrl(item: ReadableMap): String? {
    if (!item.hasKey("url")) return null
    val urlValue = item.getDynamic("url")
    val raw = when (urlValue.type) {
      com.facebook.react.bridge.ReadableType.String -> urlValue.asString()
      com.facebook.react.bridge.ReadableType.Map -> item.getMap("url")?.getString("uri")
      else -> null
    } ?: return null
    // Resolve asset:// the same way asMediaItem() does, so preload and the
    // queued playback path point at the exact same resolved URI.
    return TrackPlayerMediaItem.resolveAssetUrl(context, raw)
  }

  // endregion

  // region Destroy

  @ReactMethod
  override fun destroy() {
    controller.run { mc ->
      mc?.removeListener(this)
      mc?.release()
      controller.set(null)
    }
    MediaHeaders.clear()
  }

  // endregion

  // region Event Emitter

  override fun addListener(eventType: String?) {
    // No-op on Android
  }

  override fun removeListeners(count: Double) {
    // No-op on Android
  }

  // endregion

  // region Player.Listener

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    context.emitEvent(IsPlayingChangedEvent(isPlaying))
  }

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
    lastMediaMetadata = null
    val mc = controller.get() ?: return
    val item = if (mediaItem != null) TrackPlayerMediaItem.fromMediaItem(mediaItem).toWritableMap() else null
    context.emitEvent(MediaItemTransitionEvent(item, mc.currentMediaItemIndex))
  }

  override fun onPlayerError(error: PlaybackException) {
    context.emitEvent(PlaybackErrorEvent(
      code = classifyError(error),
      message = error.message ?: "Unknown playback error"
    ))
  }

  override fun onPlaybackStateChanged(playbackState: Int) {
    val state = when (playbackState) {
      Player.STATE_IDLE -> "idle"
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> "ready"
      Player.STATE_ENDED -> "ended"
      else -> "idle"
    }
    context.emitEvent(PlaybackStateChangedEvent(state))
  }

  override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
    val event = MediaMetadataChangedEvent(
      title = mediaMetadata.title?.toString(),
      artist = mediaMetadata.artist?.toString(),
      albumTitle = mediaMetadata.albumTitle?.toString(),
      artworkUri = mediaMetadata.artworkUri?.toString(),
      genre = mediaMetadata.genre?.toString(),
    )
    if (event.title == null && event.artist == null && event.albumTitle == null
      && event.artworkUri == null && event.genre == null) return
    if (event == lastMediaMetadata) return
    lastMediaMetadata = event
    context.emitEvent(event)
  }

  // endregion

  // region Helpers

  private fun classifyError(error: PlaybackException): String {
    return when (error.errorCode) {
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
      PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW,
      PlaybackException.ERROR_CODE_TIMEOUT,
      PlaybackException.ERROR_CODE_IO_UNSPECIFIED -> "network"

      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
      PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
      PlaybackException.ERROR_CODE_IO_NO_PERMISSION,
      PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED,
      PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE,
      PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE,
      PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DRM_UNSPECIFIED,
      PlaybackException.ERROR_CODE_DRM_SCHEME_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DRM_PROVISIONING_FAILED,
      PlaybackException.ERROR_CODE_DRM_CONTENT_ERROR,
      PlaybackException.ERROR_CODE_DRM_LICENSE_ACQUISITION_FAILED,
      PlaybackException.ERROR_CODE_DRM_DISALLOWED_OPERATION,
      PlaybackException.ERROR_CODE_DRM_SYSTEM_ERROR,
      PlaybackException.ERROR_CODE_DRM_DEVICE_REVOKED,
      PlaybackException.ERROR_CODE_DRM_LICENSE_EXPIRED -> "source"

      PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
      PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DECODING_RESOURCES_RECLAIMED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_INIT_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_WRITE_FAILED -> "renderer"

      else -> "unknown"
    }
  }

  private fun readableArrayToMediaItems(data: ReadableArray): List<MediaItem> {
    val mediaItems = mutableListOf<MediaItem>()
    for (i in 0 until data.size()) {
      data.getMap(i)?.let { map ->
        mediaItems.add(TrackPlayerMediaItem.fromReadableMap(map).asMediaItem(context))
      }
    }
    return mediaItems
  }

  // endregion

  companion object {
    const val NAME = "TrackPlayer"
    const val PLAYER_PREFS_NAME = "TrackPlayerPrefs"
  }
}
