import path from "node:path";
import { app } from "electron";
import {
  captureSelectedRegion,
  type CaptureOptions,
  type CaptureResult,
} from "./captureScreen.js";
import { analyzeImage, loadAIConfig, type AIConfig } from "./aiClient.js";

const DEFAULT_CAPTURE_DELAY_MS = 300;
const DEFAULT_JPEG_QUALITY = 92;
const DEFAULT_OUTPUT_DIR = "aicapture";

export type { AIConfig, CaptureOptions, CaptureResult };

export type CaptureAndAnalyzeOptions = {
  imgDir?: string;
  delayMs?: number;
  jpegQuality?: number;
  config?: AIConfig;
};

export type CaptureAndAnalyzeResult = {
  screenshot: CaptureResult;
  analysis: string;
};

export { analyzeImage, loadAIConfig, captureSelectedRegion };

export async function captureAndAnalyze(
  options: CaptureAndAnalyzeOptions = {},
): Promise<CaptureAndAnalyzeResult> {
  await app.whenReady();

  const config = options.config ?? loadAIConfig();
  const imgDir = options.imgDir ?? path.join(process.cwd(), DEFAULT_OUTPUT_DIR);
  const screenshot = await captureSelectedRegion({
    imgDir,
    delayMs: options.delayMs ?? DEFAULT_CAPTURE_DELAY_MS,
    jpegQuality: options.jpegQuality ?? DEFAULT_JPEG_QUALITY,
  });
  const analysis = await analyzeImage({
    base64Image: screenshot.base64,
    mimeType: screenshot.mimeType,
    config,
  });

  return { screenshot, analysis };
}
