package com.eyelertmonitor.mjpeg

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MjpegViewManager : SimpleViewManager<MjpegSurfaceView>() {

  override fun getName(): String = "MjpegStreamView"

  override fun createViewInstance(reactContext: ThemedReactContext): MjpegSurfaceView =
      MjpegSurfaceView(reactContext)

  @ReactProp(name = "streamUrl")
  fun setStreamUrl(view: MjpegSurfaceView, streamUrl: String?) {
    view.setStreamUrl(streamUrl)
  }
}
