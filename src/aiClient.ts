import fs from "node:fs";
import path from "node:path";

const MAX_OUTPUT_TOKENS = 4096;

export type AIConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
};

function loadDotEnv(cwd: string = process.cwd()): void {
  const envPath = path.join(cwd, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && (process.env[key] === undefined || process.env[key] === "")) {
      process.env[key] = value;
    }
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少 ${name}。请在环境变量或 .env 文件中配置`);
  }

  return value;
}

export function loadAIConfig(): AIConfig {
  loadDotEnv();

  return {
    baseUrl: readRequiredEnv("ai_base_url").replace(/\/+$/, ""),
    apiKey: readRequiredEnv("ai_api_key"),
    model: readRequiredEnv("ai_model"),
    prompt: readRequiredEnv("AI_PROMPT"),
  };
}

function extractResponsesText(data: unknown): string {
  const record = data as {
    output_text?: unknown;
    output?: unknown;
  };

  if (typeof record.output_text === "string" && record.output_text) {
    return record.output_text;
  }

  if (Array.isArray(record.output)) {
    const textParts: string[] = [];
    for (const outputItem of record.output) {
      const content = (outputItem as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;

      for (const contentItem of content) {
        if (typeof (contentItem as { text?: unknown }).text === "string") {
          textParts.push((contentItem as { text: string }).text);
        }
      }
    }

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

export type AnalyzeImageInput = {
  base64Image: string;
  mimeType: string;
  config: AIConfig;
};

export async function analyzeImage({
  base64Image,
  mimeType,
  config,
}: AnalyzeImageInput): Promise<string> {
  const imageUri = `data:${mimeType};base64,${base64Image}`;
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: imageUri },
            { type: "input_text", text: config.prompt },
          ],
        },
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      message?: string;
    };
    const message =
      errorData.error?.message ||
      errorData.message ||
      response.statusText ||
      "未知错误";
    throw new Error(
      `AI Responses API 请求失败 (${response.status}): ${message}`,
    );
  }

  const data = (await response.json()) as unknown;
  const content = extractResponsesText(data);
  if (!content) {
    throw new Error("AI Responses API 返回格式异常：未找到输出文本");
  }

  return content;
}
