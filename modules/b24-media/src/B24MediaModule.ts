import { requireNativeModule } from 'expo';

const Native = requireNativeModule('B24Media');

// Converts a local video file to mp4 (h264 + aac). Resolves with the output path.
export function videoToMp4(inputPath: string, outputPath: string): Promise<string> {
  return Native.videoToMp4(inputPath, outputPath);
}
