import { requireNativeModule } from 'expo';

const Native = requireNativeModule('B24Media');

// Converts a local video file to mp4 (h264 + aac). Resolves with the output path.
export function videoToMp4(inputPath: string, outputPath: string): Promise<string> {
  return Native.videoToMp4(inputPath, outputPath);
}

// Converts a local m4a/aac/mp3 audio file to mp3 with the Rust encoder. Resolves with the output path.
export function audioToMp3(inputPath: string, outputPath: string, kbps: number = 192): Promise<string> {
  return Native.audioToMp3(inputPath, outputPath, kbps);
}
