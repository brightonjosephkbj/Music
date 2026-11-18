/*
 * Copyright (c) Double Symmetry GmbH
 * Commercial use requires a license. See https://rntp.dev/pricing
 */

package com.doublesymmetry.trackplayer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import androidx.annotation.OptIn
import androidx.media3.cast.CastPlayer
import androidx.media3.cast.RemoteCastPlayer
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Metadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.offline.HlsDownloader
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import java.io.File
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSession.ConnectionResult.AcceptedResultBuilder
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.doublesymmetry.trackplayer.extensions.emitEvent
import com.doublesymmetry.trackplayer.models.BrowseTree
import com.doublesymmetry.trackplayer.models.MetadataApplier
import com.doublesymmetry.trackplayer.models.TrackPlayerCastMediaItemConverter
import com.doublesymmetry.trackplayer.models.MetadataReceivedEvent
import com.doublesymmetry.trackplayer.models.StreamMetadataExtractor
import com.doublesymmetry.trackplayer.models.PlayerCommand
import com.doublesymmetry.trackplayer.models.PlayerConfig
import com.doublesymmetry.trackplayer.models.LiveResumeBehavior
import com.doublesymmetry.trackplayer.models.RemoteControlHandling
import com.doublesymmetry.trackplayer.models.RemotePlayEvent
import com.doublesymmetry.trackplayer.models.RemotePauseEvent
import com.doublesymmetry.trackplayer.models.RemoteNextEvent
import com.doublesymmetry.trackplayer.models.RemotePreviousEvent
import com.doublesymmetry.trackplayer.models.RemoteStopEvent
import com.doublesymmetry.trackplayer.models.RemoteSeekEvent
import com.doublesymmetry.trackplayer.models.RemoteSkipForwardEvent
import com.doublesymmetry.trackplayer.models.RemoteSkipBackwardEvent
import com.doublesymmetry.trackplayer.models.TaskRemovedBehavior
import com.doublesymmetry.trackplayer.models.WakeMode
import android.os.Handler
import android.os.Looper
import com.doublesymmetry.trackplayer.models.PlaybackProgressUpdatedEvent
import com.doublesymmetry.trackplayer.models.SleepTimerTriggeredEvent
import org.json.JSONObject

class TrackPlayerPlaybackService: MediaLibraryService(), MediaLibraryService.MediaLibrarySession.Callback {
  private var mediaSession: MediaLibraryService.MediaLibrarySession? = null
  internal var playerConfig: PlayerConfig? = null
  private var simpleCache: SimpleCache? = null
  private var exoPlayer: ExoPlayer? = null
  internal var castPlayer: CastPlayer? = null
  internal var activePlayer: Player? = null
  private var progressSyncTimer: java.util.Timer? = null
  private var progressSyncExecutor: java.util.concurrent.ExecutorService? = null

  private var sleepTimerController: SleepTimerController? = null
  private var sleepTimer: java.util.Timer? = null

  // Last stream metadata event for the current item; cleared on item transition.
  private var lastStreamMetadata: MetadataReceivedEvent? = null

  private val activePreloads = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.Future<*>>()
  private val preloadExecutor = java.util.concurrent.Executors.newFixedThreadPool(2)

  @OptIn(UnstableApi::class)
  override fun onCreate() {
    super.onCreate()

    playerConfig = PlayerConfig().load(this)
    val config = playerConfig ?: PlayerConfig()

    val audioAttributes = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(
        if (config.contentType == "speech") C.AUDIO_CONTENT_TYPE_SPEECH
        else C.AUDIO_CONTENT_TYPE_MUSIC
      )
      .build()

    val httpFactory = HeaderInjectingDataSourceFactory(
      DefaultHttpDataSource.Factory()
    )
    val upstreamFactory: DataSource.Factory = DefaultDataSource.Factory(this, httpFactory)

    val mediaSourceFactory: MediaSource.Factory = config.cacheMaxSizeBytes?.let { maxBytes ->
      val cacheDir = File(cacheDir, "trackplayer_cache")
      val evictor = LeastRecentlyUsedCacheEvictor(maxBytes)
      val cache = SimpleCache(cacheDir, evictor)
      simpleCache = cache
      sharedCache = cache
      val cacheDataSourceFactory = CacheDataSource.Factory()
        .setCache(cache)
        .setUpstreamDataSourceFactory(upstreamFactory)
      // Live streams bypass the cache (their ephemeral segments would only churn
      // the LRU); non-live tracks read/write through it. When caching is off,
      // every track uses the bare upstream factory and no routing is needed.
      LivenessRoutingMediaSourceFactory(
        cachedFactory = DefaultMediaSourceFactory(cacheDataSourceFactory),
        uncachedFactory = DefaultMediaSourceFactory(upstreamFactory)
      )
    } ?: DefaultMediaSourceFactory(upstreamFactory)

    val built = ExoPlayer.Builder(this)
      .setMediaSourceFactory(LiveRefreshMediaSourceFactory(mediaSourceFactory))
      .setAudioAttributes(audioAttributes, config.audioMixing != "mix")
      .setHandleAudioBecomingNoisy(config.handleAudioBecomingNoisy)
      .setWakeMode(
        when (config.wakeMode) {
          WakeMode.NONE -> C.WAKE_MODE_NONE
          WakeMode.LOCAL -> C.WAKE_MODE_LOCAL
          WakeMode.NETWORK -> C.WAKE_MODE_NETWORK
        }
      )
      .setSkipSilenceEnabled(config.skipSilenceEnabled)
      .setSeekForwardIncrementMs(config.forwardInterval * 1000)
      .setSeekBackIncrementMs(config.backwardInterval * 1000)
      .build()
    exoPlayer = built

    if (config.preloadWindow > 0 && config.cacheMaxSizeBytes != null) {
      built.preloadConfiguration = ExoPlayer.PreloadConfiguration(
        /* targetPreloadDurationUs= */ Long.MAX_VALUE  // Full file for auto preloading
      )
    }

    // If Cast is enabled, wrap ExoPlayer inside CastPlayer — Media3 automatically
    // routes playback to the Chromecast when a session is active, and back to
    // ExoPlayer when it ends. No manual player swapping needed.
    val activePlayer: Player = config.castReceiverAppId?.let { appId ->
      android.util.Log.d("TrackPlayer", "Cast enabled (appId=$appId), building CastPlayer")
      try {
        val remoteCastPlayer = RemoteCastPlayer.Builder(this)
          .setMediaItemConverter(TrackPlayerCastMediaItemConverter())
          .build()
        CastPlayer.Builder(this)
          .setLocalPlayer(built)
          .setRemotePlayer(remoteCastPlayer)
          .build()
          .also {
            castPlayer = it
            android.util.Log.d(
              "TrackPlayer",
              "CastPlayer created, isCastSessionAvailable=${it.isCastSessionAvailable()}",
            )
          }
      } catch (e: Exception) {
        android.util.Log.e("TrackPlayer", "Cast setup failed — ensure OPTIONS_PROVIDER_CLASS_NAME is set in AndroidManifest.xml", e)
        null
      }
    } ?: built.also { android.util.Log.d("TrackPlayer", "Cast disabled, using ExoPlayer only") }

    this.activePlayer = activePlayer

    val controller = SleepTimerController(activePlayer)
    sleepTimerController = controller
    controller.onTriggered = { type ->
      this@TrackPlayerPlaybackService.emitEvent(SleepTimerTriggeredEvent(type))
      if (type == "mediaItem") {
        // Defer pause to next run loop — calling during transition gets overridden
        Handler(Looper.getMainLooper()).post { activePlayer.pause() }
      }
    }
    controller.onStateChanged = { persistSleepTimerState() }

    activePlayer.addListener(object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) startProgressSyncTimer() else stopProgressSyncTimer(fireFinalTick = true)
      }

      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
        val currentIndex = activePlayer?.currentMediaItemIndex ?: 0
        sleepTimerController?.handleItemTransition(currentIndex)
        lastStreamMetadata = null
      }

      override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
        if (sleepTimerController?.sleepTimerType == "mediaItem" && (activePlayer?.mediaItemCount ?: 0) == 0) {
          sleepTimerController?.cancelInternal(restoreVolume = false)
        }
      }

      // MediaController does not forward onMetadata; handle ICY/ID3 stream metadata here.
      override fun onMetadata(metadata: Metadata) {
        val event = StreamMetadataExtractor.extract(metadata) ?: return
        if (event == lastStreamMetadata) return
        lastStreamMetadata = event
        this@TrackPlayerPlaybackService.emitEvent(event)
        if (playerConfig?.autoUpdateMetadataFromStream == true) {
          activePlayer?.let { MetadataApplier.applyToCurrentMediaItem(it, event) }
        }
      }
    })
    val player = createForwardingPlayer(activePlayer, config)

    val sessionActivityIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val sessionActivity = sessionActivityIntent?.let {
      PendingIntent.getActivity(
        this, 0, it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    mediaSession = MediaLibraryService.MediaLibrarySession.Builder(this, player, this)
      .apply { sessionActivity?.let { setSessionActivity(it) } }
      .build()

    setupNotificationProvider(config)
  }

  @OptIn(UnstableApi::class)
  internal fun createForwardingPlayer(player: Player, config: PlayerConfig): Player {
    return object : ForwardingPlayer(player) {
      override fun play() {
        if (shouldHandleNatively(PlayerCommand.PLAY_PAUSE)) {
          handlePlay(player)
        }
        emitRemoteEventIfNeeded(RemotePlayEvent(), PlayerCommand.PLAY_PAUSE)
      }

      override fun pause() {
        if (shouldHandleNatively(PlayerCommand.PLAY_PAUSE)) {
          super.pause()
        }
        emitRemoteEventIfNeeded(RemotePauseEvent(), PlayerCommand.PLAY_PAUSE)
      }

      override fun stop() {
        if (shouldHandleNatively(PlayerCommand.STOP)) {
          super.stop()
        }
        emitRemoteEventIfNeeded(RemoteStopEvent(), PlayerCommand.STOP)
      }

      override fun seekTo(positionMs: Long) {
        if (shouldHandleNatively(PlayerCommand.SEEK)) {
          super.seekTo(positionMs)
        }
        emitRemoteEventIfNeeded(RemoteSeekEvent(positionMs / 1000.0), PlayerCommand.SEEK)
      }

      override fun seekToNextMediaItem() {
        if (shouldHandleNatively(PlayerCommand.NEXT)) {
          super.seekToNextMediaItem()
        }
        emitRemoteEventIfNeeded(RemoteNextEvent(), PlayerCommand.NEXT)
      }

      override fun seekToPreviousMediaItem() {
        if (shouldHandleNatively(PlayerCommand.PREVIOUS)) {
          super.seekToPreviousMediaItem()
        }
        emitRemoteEventIfNeeded(RemotePreviousEvent(), PlayerCommand.PREVIOUS)
      }

      override fun seekForward() {
        if (shouldHandleNatively(PlayerCommand.SKIP_FORWARD)) {
          super.seekForward()
        }
        emitRemoteEventIfNeeded(
          RemoteSkipForwardEvent(config.forwardInterval.toDouble()),
          PlayerCommand.SKIP_FORWARD
        )
      }

      override fun seekBack() {
        if (shouldHandleNatively(PlayerCommand.SKIP_BACKWARD)) {
          super.seekBack()
        }
        emitRemoteEventIfNeeded(
          RemoteSkipBackwardEvent(config.backwardInterval.toDouble()),
          PlayerCommand.SKIP_BACKWARD
        )
      }
    }
  }

  @OptIn(UnstableApi::class)
  private fun setupNotificationProvider(config: PlayerConfig) {
    val channelId = config.notificationChannelId ?: return
    val channelName = config.notificationChannelName ?: channelId

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_LOW)
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(channel)
    }

    val provider = DefaultMediaNotificationProvider.Builder(this)
      .setChannelId(channelId)
      .build()

    config.notificationSmallIcon?.let { iconName ->
      val iconRes = resources.getIdentifier(iconName, "drawable", packageName)
      if (iconRes != 0) {
        provider.setSmallIcon(iconRes)
      }
    }

    setMediaNotificationProvider(provider)
  }

  override fun onGetSession(
    controllerInfo: MediaSession.ControllerInfo
  ): MediaLibraryService.MediaLibrarySession? = mediaSession

  @OptIn(UnstableApi::class)
  override fun onTaskRemoved(rootIntent: Intent?) {
    val config = playerConfig ?: PlayerConfig().load(this)
    if (config.taskRemovedBehavior == TaskRemovedBehavior.STOP) {
      stopForTaskRemoved()
      return
    }
    val player = mediaSession?.player ?: return
    if (!player.playWhenReady
      || player.mediaItemCount == 0
      || player.playbackState == Player.STATE_ENDED) {
      pauseAllPlayersAndStopSelf()
    }
  }

  @OptIn(UnstableApi::class)
  private fun stopForTaskRemoved() {
    mediaSession?.player?.clearMediaItems()
    pauseAllPlayersAndStopSelf()
  }

  override fun onDestroy() {
    mediaSession?.run {
      player.release()
      release()
      mediaSession = null
    }
    activePlayer = null
    // Release exoPlayer explicitly when Cast is active (CastPlayer may not own it).
    exoPlayer?.release()
    exoPlayer = null
    castPlayer = null
    simpleCache?.release()
    simpleCache = null
    sharedCache = null
    sleepTimerController?.cancelInternal(restoreVolume = false)
    sleepTimerController = null
    sleepTimer?.cancel()
    sleepTimer = null
    activePreloads.values.forEach { it.cancel(true) }
    activePreloads.clear()
    preloadExecutor.shutdownNow()
    stopProgressSyncTimer(fireFinalTick = false)
    progressSyncExecutor?.shutdown()
    progressSyncExecutor = null
    super.onDestroy()
  }

  // region MediaLibrarySession.Callback

  @OptIn(UnstableApi::class)
  override fun onConnect(
    session: MediaSession,
    controller: MediaSession.ControllerInfo
  ): MediaSession.ConnectionResult {
    playerConfig = PlayerConfig().load(this)

    return AcceptedResultBuilder(session)
      .setAvailableSessionCommands(buildSessionCommands())
      .setAvailablePlayerCommands(buildPlayerCommands(playerConfig ?: PlayerConfig()))
      .build()
  }

  override fun onCustomCommand(
    session: MediaSession,
    controller: MediaSession.ControllerInfo,
    customCommand: SessionCommand,
    args: Bundle
  ): ListenableFuture<SessionResult> {
    when (customCommand.customAction) {
      COMMAND_UPDATE_COMMANDS -> {
        playerConfig = PlayerConfig().load(this)
        val playerCommands = buildPlayerCommands(playerConfig ?: PlayerConfig())
        val sessionCommands = buildSessionCommands()
        for (connectedController in session.connectedControllers) {
          session.setAvailableCommands(connectedController, sessionCommands, playerCommands)
        }
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_UPDATE_BROWSE_TREE -> {
        (session as? MediaLibraryService.MediaLibrarySession)?.let { libSession ->
          val browseTree = BrowseTree.load(this)
          libSession.notifyChildrenChanged(BROWSE_ROOT_ID, browseTree.categories.size, null)
        }
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_UPDATE_PROGRESS_SYNC_HEADERS -> {
        playerConfig = PlayerConfig().load(this)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_PLAY -> {
        activePlayer?.let(::handlePlay)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SEEK_TO_LIVE_EDGE -> {
        activePlayer?.let { LiveEdgeController.seekToLiveEdge(it, currentPlaybackRoute()) }
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_PAUSE -> {
        activePlayer?.pause()
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_STOP -> {
        activePlayer?.stop()
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SEEK_TO -> {
        val positionMs = args.getLong("positionMs")
        activePlayer?.seekTo(positionMs)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SEEK_BY -> {
        val offsetSeconds = args.getDouble("offsetSeconds")
        val currentPosition = activePlayer?.currentPosition ?: 0L
        val newPosition = currentPosition + (offsetSeconds * 1000).toLong()
        activePlayer?.seekTo(newPosition)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SEEK_TO_NEXT -> {
        activePlayer?.seekToNextMediaItem()
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SEEK_TO_PREVIOUS -> {
        activePlayer?.seekToPreviousMediaItem()
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SLEEP_AFTER_TIME -> {
        val seconds = args.getDouble("seconds")
        val fadeOutSeconds = args.getDouble("fadeOutSeconds")
        sleepTimerController?.sleepAfterTime(seconds, fadeOutSeconds)
        if (seconds > 0) startSleepCountdownTimer()
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_SLEEP_AFTER_MEDIA_ITEM -> {
        val index = args.getInt("index")
        sleepTimerController?.sleepAfterMediaItemAtIndex(index)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_CANCEL_SLEEP_TIMER -> {
        sleepTimerController?.cancel()
        sleepTimer?.cancel()
        sleepTimer = null
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_PRELOAD -> {
        val uri = args.getString("uri") ?: return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_UNKNOWN))
        preloadUri(uri)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
      COMMAND_CANCEL_PRELOAD -> {
        val uri = args.getString("uri") ?: return Futures.immediateFuture(SessionResult(SessionResult.RESULT_ERROR_UNKNOWN))
        cancelPreloadUri(uri)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }
    }
    return super.onCustomCommand(session, controller, customCommand, args)
  }

  override fun onGetLibraryRoot(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    params: LibraryParams?
  ): ListenableFuture<LibraryResult<MediaItem>> {
    val root = MediaItem.Builder()
      .setMediaId(BROWSE_ROOT_ID)
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setIsBrowsable(true)
          .setIsPlayable(false)
          .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
          .build()
      )
      .build()
    return Futures.immediateFuture(LibraryResult.ofItem(root, params))
  }

  override fun onGetChildren(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    parentId: String,
    page: Int,
    pageSize: Int,
    params: LibraryParams?
  ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
    val browseTree = BrowseTree.load(this)

    if (parentId == BROWSE_ROOT_ID) {
      val categoryItems = browseTree.categories.map { category ->
        MediaItem.Builder()
          .setMediaId(category.mediaId)
          .setMediaMetadata(
            MediaMetadata.Builder()
              .setTitle(category.title)
              .setIsBrowsable(true)
              .setIsPlayable(false)
              .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
              .build()
          )
          .build()
      }
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(categoryItems), params))
    }

    // Check if it's a category
    val category = browseTree.findCategory(parentId)
    if (category != null) {
      val mediaItems = category.items.map { it.toMediaItem(this) }
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(mediaItems), params))
    }

    // Check if it's a browsable item with children
    val browseItem = browseTree.findItem(parentId)
    if (browseItem != null && browseItem.children != null) {
      val mediaItems = browseItem.children.map { it.toMediaItem(this) }
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(mediaItems), params))
    }

    return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))
  }

  override fun onGetItem(
    session: MediaLibraryService.MediaLibrarySession,
    browser: MediaSession.ControllerInfo,
    mediaId: String
  ): ListenableFuture<LibraryResult<MediaItem>> {
    val browseTree = BrowseTree.load(this)

    val category = browseTree.findCategory(mediaId)
    if (category != null) {
      val item = MediaItem.Builder()
        .setMediaId(category.mediaId)
        .setMediaMetadata(
          MediaMetadata.Builder()
            .setTitle(category.title)
            .setIsBrowsable(true)
            .setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)
            .build()
        )
        .build()
      return Futures.immediateFuture(LibraryResult.ofItem(item, null))
    }

    val browseItem = browseTree.findItem(mediaId)
    if (browseItem != null) {
      return Futures.immediateFuture(LibraryResult.ofItem(browseItem.toMediaItem(this), null))
    }

    return Futures.immediateFuture(LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))
  }

  @OptIn(UnstableApi::class)
  override fun onSetMediaItems(
    mediaSession: MediaSession,
    controller: MediaSession.ControllerInfo,
    mediaItems: MutableList<MediaItem>,
    startIndex: Int,
    startPositionMs: Long,
  ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
    val browseTree = BrowseTree.load(this)

    if (mediaItems.size == 1 && mediaItems[0].localConfiguration == null) {
      browseTree.findPlayableSiblings(mediaItems[0].mediaId)?.let { (siblings, index) ->
        val queue = siblings.map { it.toMediaItem(this) }
        return Futures.immediateFuture(
          MediaSession.MediaItemsWithStartPosition(queue, index, startPositionMs)
        )
      }
    }

    val resolved = mediaItems.map { resolveBrowseMediaItem(browseTree, it) }
    return Futures.immediateFuture(
      MediaSession.MediaItemsWithStartPosition(resolved, startIndex, startPositionMs)
    )
  }

  @OptIn(UnstableApi::class)
  override fun onAddMediaItems(
    mediaSession: MediaSession,
    controller: MediaSession.ControllerInfo,
    mediaItems: MutableList<MediaItem>
  ): ListenableFuture<MutableList<MediaItem>> {
    val browseTree = BrowseTree.load(this)
    val resolved = mediaItems.map { resolveBrowseMediaItem(browseTree, it) }.toMutableList()
    return Futures.immediateFuture(resolved)
  }

  private fun resolveBrowseMediaItem(browseTree: BrowseTree, requested: MediaItem): MediaItem {
    if (requested.localConfiguration != null) return requested
    val browseItem = browseTree.findItem(requested.mediaId)
    return browseItem?.toMediaItem(this) ?: requested
  }

  // endregion

  // region Session Commands

  internal fun buildSessionCommands() =
    MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
      .add(SessionCommand(COMMAND_UPDATE_COMMANDS, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_UPDATE_BROWSE_TREE, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_PLAY, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SEEK_TO_LIVE_EDGE, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_PAUSE, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_STOP, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SEEK_TO, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SEEK_BY, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SEEK_TO_NEXT, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SEEK_TO_PREVIOUS, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_UPDATE_PROGRESS_SYNC_HEADERS, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SLEEP_AFTER_TIME, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_SLEEP_AFTER_MEDIA_ITEM, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_CANCEL_SLEEP_TIMER, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_PRELOAD, Bundle.EMPTY))
      .add(SessionCommand(COMMAND_CANCEL_PRELOAD, Bundle.EMPTY))
      .build()

  // endregion

  // region Player Commands

  private fun buildPlayerCommands(config: PlayerConfig): Player.Commands {
    val builder = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()

    builder.remove(Player.COMMAND_SEEK_TO_NEXT)
    builder.remove(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
    builder.remove(Player.COMMAND_SEEK_TO_PREVIOUS)
    builder.remove(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
    builder.remove(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
    builder.remove(Player.COMMAND_PLAY_PAUSE)
    builder.remove(Player.COMMAND_STOP)
    builder.remove(Player.COMMAND_SEEK_FORWARD)
    builder.remove(Player.COMMAND_SEEK_BACK)

    config.availableCommands.forEach {
      when (it) {
        PlayerCommand.SEEK -> builder.add(Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM)
        PlayerCommand.PLAY_PAUSE -> builder.add(Player.COMMAND_PLAY_PAUSE)
        PlayerCommand.NEXT -> {
          builder.add(Player.COMMAND_SEEK_TO_NEXT)
          builder.add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
        }
        PlayerCommand.PREVIOUS -> {
          builder.add(Player.COMMAND_SEEK_TO_PREVIOUS)
          builder.add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
        }
        PlayerCommand.STOP -> builder.add(Player.COMMAND_STOP)
        PlayerCommand.SKIP_FORWARD -> builder.add(Player.COMMAND_SEEK_FORWARD)
        PlayerCommand.SKIP_BACKWARD -> builder.add(Player.COMMAND_SEEK_BACK)
      }
    }

    return builder.build()
  }

  // endregion

  // region Remote Control Handling

  internal fun currentPlaybackRoute(): PlaybackRoute =
    if (castPlayer?.isCastSessionAvailable() == true) PlaybackRoute.REMOTE_CAST
    else PlaybackRoute.LOCAL

  internal fun handlePlay(player: Player) {
    LiveEdgeController.play(
      player,
      playerConfig?.liveResumeBehavior ?: LiveResumeBehavior.POSITION,
      currentPlaybackRoute(),
    )
  }

  private fun shouldHandleNatively(command: PlayerCommand): Boolean {
    val config = playerConfig ?: return true

    if (config.remoteControlHandling == RemoteControlHandling.HYBRID) {
      val perCommand = config.perCommandHandling[command.value]
      if (perCommand != null) {
        return perCommand == RemoteControlHandling.NATIVE
      }
    }

    return when (config.remoteControlHandling) {
      RemoteControlHandling.NATIVE -> true
      RemoteControlHandling.JS -> false
      RemoteControlHandling.HYBRID -> true
    }
  }

  private fun emitRemoteEventIfNeeded(event: com.doublesymmetry.trackplayer.models.EmitEvent, command: PlayerCommand) {
    val config = playerConfig ?: return
    val shouldEmit = when (config.remoteControlHandling) {
      RemoteControlHandling.NATIVE -> false
      RemoteControlHandling.JS -> true
      RemoteControlHandling.HYBRID -> {
        val perCommand = config.perCommandHandling[command.value]
        perCommand == RemoteControlHandling.JS
      }
    }

    if (shouldEmit) {
      this@TrackPlayerPlaybackService.emitEvent(event)
    }
  }

  // endregion

  // region Sleep Timer

  private fun startSleepCountdownTimer() {
    sleepTimer?.cancel()
    val handler = Handler(Looper.getMainLooper())
    sleepTimer = java.util.Timer().apply {
      scheduleAtFixedRate(object : java.util.TimerTask() {
        override fun run() {
          handler.post { sleepTimerController?.tick() }
        }
      }, 1000L, 1000L)
    }
  }

  private fun persistSleepTimerState() {
    val prefs = getSharedPreferences(TrackPlayerModule.PLAYER_PREFS_NAME, MODE_PRIVATE)
    val editor = prefs.edit()
    val state = sleepTimerController?.getState()
    if (state == null) {
      editor.remove(SLEEP_TIMER_STATE_KEY)
    } else {
      val type = state["type"] as String
      val json = JSONObject().apply {
        put("type", type)
        if (type == "time") {
          put("remainingSeconds", state["remainingSeconds"] as Double)
          put("fadeOutSeconds", state["fadeOutSeconds"] as Double)
        } else {
          put("index", state["index"] as Int)
        }
      }
      editor.putString(SLEEP_TIMER_STATE_KEY, json.toString())
    }
    editor.apply()
  }

  // endregion

  // region Preloading

  @OptIn(UnstableApi::class)
  private fun preloadUri(uri: String) {
    val cache = simpleCache ?: return

    val preloadUpstreamFactory = DefaultDataSource.Factory(this, DefaultHttpDataSource.Factory())
    val cacheDataSourceFactory = CacheDataSource.Factory()
      .setCache(cache)
      .setUpstreamDataSourceFactory(preloadUpstreamFactory)

    // Build the task before registering it so the map can never observe the job
    // finish before its entry exists, and so the finally-block can remove only
    // its OWN entry (a concurrent cancel + re-preload may have replaced it).
    // `self[0]` is published-before the task runs by the execute() below.
    val self = arrayOfNulls<java.util.concurrent.Future<*>>(1)
    val task = java.util.concurrent.FutureTask<Unit>(java.util.concurrent.Callable {
      try {
        if (isHlsUri(uri)) {
          // HLS: parse the playlist and warm every media segment (plus key and
          // init map) into the same SimpleCache the player reads from. Default
          // cache keys are used on both paths, so segments warmed here are hit
          // on playback. Whole-stream download is intentional: COMMAND_PRELOAD
          // carries no duration window (if one is ever added, swap this for a
          // segment-prefix downloader to match iOS's Preloader).
          HlsDownloader(MediaItem.fromUri(uri), cacheDataSourceFactory)
            .download(/* progressListener= */ null)
        } else {
          // Progressive media: a single CacheWriter pass caches the whole file.
          CacheWriter(
            cacheDataSourceFactory.createDataSource(),
            DataSpec(Uri.parse(uri)),
            /* temporaryBuffer= */ null,
            /* progressListener= */ null
          ).cache()
        }
      } catch (e: Exception) {
        // Cancelled or failed — silently ignore. On cancel the cache holds a
        // partial-but-safe span (media3 never serves an incomplete segment as
        // complete), so a later play simply re-fetches the unfinished tail.
      } finally {
        activePreloads.remove(uri, self[0])
      }
      Unit
    })
    self[0] = task

    // Atomic dedup gate: only the winner of putIfAbsent runs; a duplicate
    // in-flight preload of the same URI is dropped.
    if (activePreloads.putIfAbsent(uri, task) != null) return
    try {
      preloadExecutor.execute(task)
    } catch (e: java.util.concurrent.RejectedExecutionException) {
      // Executor already shut down (service tearing down): unregister so the map
      // doesn't retain a task that will never run.
      activePreloads.remove(uri, task)
    }
  }

  private fun cancelPreloadUri(uri: String) {
    activePreloads.remove(uri)?.cancel(true)
  }

  // endregion

  // region Progress Sync

  private fun startProgressSyncTimer() {
    val interval = playerConfig?.progressSyncIntervalSeconds ?: 0.0
    if (interval <= 0) return

    stopProgressSyncTimer(fireFinalTick = false)

    val handler = Handler(Looper.getMainLooper())
    val intervalMs = (interval * 1000).toLong()

    progressSyncTimer = java.util.Timer().apply {
      scheduleAtFixedRate(object : java.util.TimerTask() {
        override fun run() {
          handler.post { onProgressSyncTick() }
        }
      }, intervalMs, intervalMs)
    }
  }

  private fun stopProgressSyncTimer(fireFinalTick: Boolean) {
    if (fireFinalTick && progressSyncTimer != null) {
      onProgressSyncTick()
    }
    progressSyncTimer?.cancel()
    progressSyncTimer = null
  }

  private fun onProgressSyncTick() {
    val player = activePlayer ?: return
    val mediaItem = player.currentMediaItem ?: return
    val mediaId = mediaItem.mediaId
    val position = player.currentPosition / 1000.0
    val duration = player.duration / 1000.0
    val timestamp = System.currentTimeMillis()

    // Save to SharedPreferences
    val json = JSONObject().apply {
      put("mediaId", mediaId)
      put("position", position)
      put("duration", duration)
      put("timestamp", timestamp)
    }
    val prefs = getSharedPreferences(TrackPlayerModule.PLAYER_PREFS_NAME, MODE_PRIVATE)
    prefs.edit().putString(PROGRESS_SYNC_SAVED_KEY, json.toString()).apply()

    // Emit event
    this@TrackPlayerPlaybackService.emitEvent(
      PlaybackProgressUpdatedEvent(
        mediaId = mediaId,
        position = position,
        duration = duration,
        timestamp = timestamp
      )
    )

    // HTTP POST
    val config = playerConfig ?: return
    val url = config.progressSyncHttpUrl ?: return
    if (progressSyncExecutor == null) {
      progressSyncExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    }
    val headers = config.progressSyncHttpHeaders
    val body = json.toString()
    progressSyncExecutor?.execute {
      try {
        val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.setRequestProperty("Content-Type", "application/json")
        headers?.forEach { (key, value) -> connection.setRequestProperty(key, value) }
        connection.doOutput = true
        connection.outputStream.use { it.write(body.toByteArray()) }
        connection.responseCode // trigger the request
        connection.disconnect()
      } catch (_: Exception) {
        // fire-and-forget
      }
    }
  }

  // endregion

  companion object {
    const val BROWSE_ROOT_ID = "trackplayer_root"
    const val COMMAND_UPDATE_COMMANDS = "trackplayer.update_commands"
    const val COMMAND_UPDATE_BROWSE_TREE = "trackplayer.update_browse_tree"
    const val COMMAND_PLAY = "trackplayer.play"
    const val COMMAND_SEEK_TO_LIVE_EDGE = "trackplayer.seek_to_live_edge"
    const val COMMAND_PAUSE = "trackplayer.pause"
    const val COMMAND_STOP = "trackplayer.stop"
    const val COMMAND_SEEK_TO = "trackplayer.seek_to"
    const val COMMAND_SEEK_BY = "trackplayer.seek_by"
    const val COMMAND_SEEK_TO_NEXT = "trackplayer.seek_to_next"
    const val COMMAND_SEEK_TO_PREVIOUS = "trackplayer.seek_to_previous"
    const val COMMAND_UPDATE_PROGRESS_SYNC_HEADERS = "trackplayer.update_progress_sync_headers"
    const val PROGRESS_SYNC_SAVED_KEY = "progress_sync_saved"
    const val COMMAND_SLEEP_AFTER_TIME = "trackplayer.sleep_after_time"
    const val COMMAND_SLEEP_AFTER_MEDIA_ITEM = "trackplayer.sleep_after_media_item"
    const val COMMAND_CANCEL_SLEEP_TIMER = "trackplayer.cancel_sleep_timer"
    const val SLEEP_TIMER_STATE_KEY = "sleep_timer_state"
    const val COMMAND_PRELOAD = "trackplayer.preload"
    const val COMMAND_CANCEL_PRELOAD = "trackplayer.cancel_preload"

    @Volatile
    var sharedCache: SimpleCache? = null
      private set

    /** Removes all entries from the shared cache. Safe to call from any thread. */
    fun clearCache() {
      sharedCache?.let { cache ->
        cache.keys.toList().forEach { key -> cache.removeResource(key) }
      }
    }
  }
}
