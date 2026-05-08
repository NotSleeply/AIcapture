# AIcapture

English | [简体中文](./docs/README.zh.md)

AIcapture is an npm package for screenshot AI analysis.

## Install

```bash
npm install aicapture electron
```

Requires Node.js >= 18 and Electron >= 28.

## Usage (instance required)

### Main process

```ts
import { createClient } from "aicapture";

const client = createClient({
  credentials: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: "YOUR_API_KEY",
    model: "doubao-seed-2-0-mini-260428",
    prompt: "Please analyze this screenshot and summarize key UI and next steps.",
  },
  imgDir: "aicapture",
});

const { screenshot, analysis } = await client.captureAndAnalyze();

console.log(screenshot.imagePath);
console.log(analysis);
```

Note: must be called in the Electron main process. The client waits for `app.whenReady()` automatically.

### Using environment variables

```ts
import { createClient } from "aicapture";

const client = createClient();
const result = await client.captureAndAnalyze();
```

## Client API

- `createClient(options)`
- `client.captureAndAnalyze(options)`
- `client.captureSelectedRegion(options)`
- `client.analyzeImage({ base64Image, mimeType })`

## Configuration

Create a `.env` file (optional):

```env
ai_base_url=https://ark.cn-beijing.volces.com/api/v3
ai_api_key=YOUR_API_KEY
ai_model=doubao-seed-2-0-mini-260428
AI_PROMPT=Please analyze this screenshot and summarize key UI and next steps.
```

Or set environment variables directly.

| Variable | Description |
| --- | --- |
| `ai_base_url` | Base URL for Ark Responses API |
| `ai_api_key` | API key |
| `ai_model` | Vision model ID |
| `AI_PROMPT` | Prompt sent with the image |

If `createClient()` is called without `credentials` or `config`, values are read from `.env` or environment variables.

## Output

- Default output directory: `aicapture/` in the current working directory
- Override with `client.captureAndAnalyze({ imgDir })`
