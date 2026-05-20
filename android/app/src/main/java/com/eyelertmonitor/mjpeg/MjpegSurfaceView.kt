package com.eyelertmonitor.mjpeg

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.FrameLayout
import android.widget.ImageView
import com.facebook.react.uimanager.ThemedReactContext
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Reads ESP32 MJPEG (:81/stream) and renders frames natively (smooth live video).
 */
class MjpegSurfaceView(context: ThemedReactContext) : FrameLayout(context) {

  private val imageView =
      ImageView(context).apply { scaleType = ImageView.ScaleType.FIT_XY }

  private var streamThread: Thread? = null

  @Volatile private var running = false

  private var currentUrl: String? = null

  init {
    addView(imageView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun setStreamUrl(url: String?) {
    if (url == currentUrl) return
    stopStream()
    currentUrl = url
    if (url.isNullOrBlank()) return
    startStream(url)
  }

  fun stopStream() {
    running = false
    streamThread?.interrupt()
    streamThread = null
  }

  private fun startStream(url: String) {
    running = true
    streamThread =
        thread(name = "Esp32MjpegStream", isDaemon = true) {
          var connection: HttpURLConnection? = null
          try {
            connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 10_000
            connection.readTimeout = 0
            connection.doInput = true
            connection.connect()

            val input = connection.inputStream
            val accumulator = ByteArrayOutputStream()
            val chunk = ByteArray(16 * 1024)

            while (running && !Thread.currentThread().isInterrupted) {
              val read = input.read(chunk)
              if (read <= 0) break

              accumulator.write(chunk, 0, read)
              var bytes = accumulator.toByteArray()

              while (running) {
                val start = indexOfJpegStart(bytes)
                if (start < 0) break

                val end = indexOfJpegEnd(bytes, start + 2)
                if (end < 0) break

                val frame = bytes.copyOfRange(start, end + 2)
                val bitmap = BitmapFactory.decodeByteArray(frame, 0, frame.size)
                if (bitmap != null) {
                  post {
                    if (running) {
                      imageView.setImageBitmap(bitmap)
                    }
                  }
                }

                bytes = bytes.copyOfRange(end + 2, bytes.size)
                accumulator.reset()
                accumulator.write(bytes)
              }

              if (accumulator.size() > 512 * 1024) {
                accumulator.reset()
              }
            }
          } catch (_: Exception) {
            // Stream ended or interrupted
          } finally {
            try {
              connection?.disconnect()
            } catch (_: Exception) {
            }
          }
        }
  }

  private fun indexOfJpegStart(data: ByteArray): Int {
    for (i in 0 until data.size - 1) {
      if (data[i] == 0xFF.toByte() && data[i + 1] == 0xD8.toByte()) return i
    }
    return -1
  }

  private fun indexOfJpegEnd(data: ByteArray, fromIndex: Int): Int {
    for (i in fromIndex until data.size - 1) {
      if (data[i] == 0xFF.toByte() && data[i + 1] == 0xD9.toByte()) return i
    }
    return -1
  }

  override fun onDetachedFromWindow() {
    stopStream()
    super.onDetachedFromWindow()
  }
}
