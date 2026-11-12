package expo.modules.b24media

import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.Promise
import expo.modules.kotlin.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

@OptIn(UnstableApi::class)
class B24MediaModule : Module() {
  private val running = mutableSetOf<Transformer>()

  private fun toUri(p: String): Uri =
    if (p.startsWith("file://") || p.startsWith("content://")) Uri.parse(p)
    else Uri.fromFile(File(p))

  private fun toPath(p: String): String =
    if (p.startsWith("file://")) (Uri.parse(p).path ?: p.removePrefix("file://")) else p

  override fun definition() = ModuleDefinition {
    Name("B24Media")

    // Converts any video the phone can decode (webm, mkv, mp4...) to mp4 (h264 + aac).
    AsyncFunction("videoToMp4") { inputPath: String, outputPath: String, promise: Promise ->
      val ctx = appContext.reactContext?.applicationContext
      if (ctx == null) {
        promise.reject("E_NO_CONTEXT", "No Android context available", null)
      } else {
        try {
          val outFile = File(toPath(outputPath))
          outFile.parentFile?.mkdirs()
          if (outFile.exists()) outFile.delete()

          val item = EditedMediaItem.Builder(MediaItem.fromUri(toUri(inputPath))).build()
          lateinit var transformer: Transformer
          transformer = Transformer.Builder(ctx)
            .setVideoMimeType(MimeTypes.VIDEO_H264)
            .setAudioMimeType(MimeTypes.AUDIO_AAC)
            .addListener(object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                running.remove(transformer)
                promise.resolve(outFile.absolutePath)
              }

              override fun onError(
                composition: Composition,
                exportResult: ExportResult,
                exportException: ExportException
              ) {
                running.remove(transformer)
                promise.reject("E_CONVERT", exportException.message ?: "conversion failed", exportException)
              }
            })
            .build()
          running.add(transformer)
          transformer.start(item, outFile.absolutePath)
        } catch (e: Exception) {
          promise.reject("E_START", e.message ?: "could not start conversion", e)
        }
      }
    }.runOnQueue(Queues.MAIN)
  }
}
