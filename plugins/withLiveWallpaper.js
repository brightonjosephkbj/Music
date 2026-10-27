const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SERVICE = "com.b24.wallpaper.B24WallpaperService";

const KOTLIN = `package com.b24.wallpaper

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.MediaPlayer
import android.service.wallpaper.WallpaperService
import android.util.Log
import android.view.SurfaceHolder
import java.io.File
import java.io.FileInputStream

class B24WallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine {
        return VideoEngine()
    }

    inner class VideoEngine : Engine() {
        private var player: MediaPlayer? = null
        private var holderRef: SurfaceHolder? = null
        private var visibleNow = false
        private var loadedStamp = 0L

        private fun videoFile(): File {
            return File(this@B24WallpaperService.filesDir, "wallpaper.mp4")
        }

        private fun showMessage(text: String) {
            val h = holderRef ?: return
            try {
                val c: Canvas? = h.lockCanvas()
                if (c != null) {
                    c.drawColor(Color.parseColor("#121110"))
                    val p = Paint()
                    p.color = Color.parseColor("#FF7A3D")
                    p.textSize = 42f
                    p.isAntiAlias = true
                    var y = 300f
                    for (line in text.split("|")) {
                        c.drawText(line, 40f, y, p)
                        y += 60f
                    }
                    h.unlockCanvasAndPost(c)
                }
            } catch (e: Exception) {
                Log.e("B24Wallpaper", "draw failed", e)
            }
        }

        private fun release() {
            val p = player
            player = null
            if (p != null) {
                try { p.setSurface(null) } catch (e: Exception) {}
                try { p.stop() } catch (e: Exception) {}
                try { p.release() } catch (e: Exception) {}
            }
        }

        private fun start() {
            release()
            val h = holderRef ?: return
            val f = videoFile()
            if (!f.exists() || f.length() == 0L) {
                Log.e("B24Wallpaper", "video file missing")
                showMessage("No wallpaper video found|Open Obsidian, Home background|and tap the wallpaper button again")
                return
            }
            try {
                val mp = MediaPlayer()
                val input = FileInputStream(f)
                try {
                    mp.setDataSource(input.fd)
                } finally {
                    input.close()
                }
                mp.setSurface(h.surface)
                mp.setVolume(0f, 0f)
                mp.isLooping = true
                mp.setOnPreparedListener { p ->
                    try { p.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING) } catch (e: Exception) {}
                    if (visibleNow) {
                        try { p.start() } catch (e: Exception) {}
                    }
                }
                mp.setOnErrorListener { _, what, extra ->
                    Log.e("B24Wallpaper", "player error " + what + " " + extra)
                    release()
                    showMessage("Video could not play|error " + what + " / " + extra + "|try a short H.264 mp4")
                    true
                }
                player = mp
                loadedStamp = f.lastModified()
                mp.prepareAsync()
            } catch (e: Exception) {
                Log.e("B24Wallpaper", "start failed", e)
                release()
                showMessage("Wallpaper failed to start|" + (e.message ?: "unknown error"))
            }
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            holderRef = holder
            if (visibleNow) start()
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            release()
            holderRef = null
            super.onSurfaceDestroyed(holder)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            visibleNow = visible
            if (visible) {
                if (player == null || videoFile().lastModified() != loadedStamp) {
                    start()
                } else {
                    try { player?.start() } catch (e: Exception) { start() }
                }
            } else {
                try { player?.pause() } catch (e: Exception) {}
            }
        }

        override fun onDestroy() {
            release()
            super.onDestroy()
        }
    }
}
`;

const XML = `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:thumbnail="@mipmap/ic_launcher" />
`;

function withWallpaperManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest["uses-feature"] = manifest["uses-feature"] || [];
    if (!manifest["uses-feature"].some((f) => f.$["android:name"] === "android.software.live_wallpaper")) {
      manifest["uses-feature"].push({
        $: { "android:name": "android.software.live_wallpaper", "android:required": "false" },
      });
    }
    const app = manifest.application[0];
    app.service = app.service || [];
    if (!app.service.some((s) => s.$["android:name"] === SERVICE)) {
      app.service.push({
        $: {
          "android:name": SERVICE,
          "android:label": "Obsidian",
          "android:exported": "true",
          "android:permission": "android.permission.BIND_WALLPAPER",
        },
        "intent-filter": [{ action: [{ $: { "android:name": "android.service.wallpaper.WallpaperService" } }] }],
        "meta-data": [{ $: { "android:name": "android.service.wallpaper", "android:resource": "@xml/b24_wallpaper" } }],
      });
    }
    return cfg;
  });
}

function withWallpaperFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const ktDir = path.join(root, "app/src/main/java/com/b24/wallpaper");
      const xmlDir = path.join(root, "app/src/main/res/xml");
      fs.mkdirSync(ktDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(ktDir, "B24WallpaperService.kt"), KOTLIN);
      fs.writeFileSync(path.join(xmlDir, "b24_wallpaper.xml"), XML);
      return cfg;
    },
  ]);
}

module.exports = (config) => withWallpaperFiles(withWallpaperManifest(config));
