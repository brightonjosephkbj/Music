package expo.modules.b24media

// JNI bridge to the Rust encoder in native/b24audio (libb24audio.so).
class B24Audio {
  companion object {
    init {
      System.loadLibrary("b24audio")
    }
  }

  // Returns "" on success, otherwise an error message.
  external fun nativeAudioToMp3(input: String, output: String, kbps: Int): String
}
