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

export type ClientDefaults = {
  imgDir?: string;
  delayMs?: number;
  jpegQuality?: number;
};

export type ClientConfigInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
};

export type CreateClientOptions = ClientDefaults & {
  config?: AIConfig;
  credentials?: ClientConfigInput;
};

export type CaptureAndAnalyzeResult = {
  screenshot: CaptureResult;
  analysis: string;
};

export type AICaptureClient = {
  config: AIConfig;
  captureSelectedRegion: (options?: ClientDefaults) => Promise<CaptureResult>;
  analyzeImage: (
    input: Omit<Parameters<typeof analyzeImage>[0], "config">,
  ) => Promise<string>;
  captureAndAnalyze: (
    options?: ClientDefaults,
  ) => Promise<CaptureAndAnalyzeResult>;
};

function resolveConfig(options: CreateClientOptions): AIConfig {
  if (options.config) {
    return options.config;
  }

  if (options.credentials) {
    return {
      baseUrl: options.credentials.baseUrl.replace(/\/+$/, ""),
      apiKey: options.credentials.apiKey,
      model: options.credentials.model,
      prompt: options.credentials.prompt,
    };
  }

  return loadAIConfig();
}

function resolveDefaults(
  options: ClientDefaults = {},
): Required<ClientDefaults> {
  return {
    imgDir: options.imgDir ?? path.join(process.cwd(), DEFAULT_OUTPUT_DIR),
    delayMs: options.delayMs ?? DEFAULT_CAPTURE_DELAY_MS,
    jpegQuality: options.jpegQuality ?? DEFAULT_JPEG_QUALITY,
  };
}

export function createClient(
  options: CreateClientOptions = {},
): AICaptureClient {
  const clientConfig = resolveConfig(options);
  const clientDefaults = resolveDefaults(options);

  return {
    config: clientConfig,
    captureSelectedRegion: async (overrideDefaults = {}) => {
      await app.whenReady();
      const resolved = resolveDefaults({
        ...clientDefaults,
        ...overrideDefaults,
      });

      return captureSelectedRegion({
        imgDir: resolved.imgDir,
        delayMs: resolved.delayMs,
        jpegQuality: resolved.jpegQuality,
      });
    },
    analyzeImage: async (input) =>
      analyzeImage({
        ...input,
        config: clientConfig,
      }),
    captureAndAnalyze: async (overrideDefaults = {}) => {
      await app.whenReady();
      const resolved = resolveDefaults({
        ...clientDefaults,
        ...overrideDefaults,
      });
      const screenshot = await captureSelectedRegion({
        imgDir: resolved.imgDir,
        delayMs: resolved.delayMs,
        jpegQuality: resolved.jpegQuality,
      });
      const analysis = await analyzeImage({
        base64Image: screenshot.base64,
        mimeType: screenshot.mimeType,
        config: clientConfig,
      });

      return { screenshot, analysis };
    },
  };
}
