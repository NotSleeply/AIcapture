# AIcapture

[English](README.md) | 简体中文

AIcapture 是一个截图AI分析npm包。

## 安装

```bash
npm install aicapture electron
```

需要 Node.js >= 18、Electron >= 28。

## 使用（必须创建实例）

### 主进程调用

```ts
import { createClient } from "aicapture";

const client = createClient({
  credentials: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: "你的火山引擎方舟 API Key",
    model: "doubao-seed-2-0-mini-260428",
    prompt: "请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。",
  },
  imgDir: "aicapture",
});

const { screenshot, analysis } = await client.captureAndAnalyze();

console.log(screenshot.imagePath);
console.log(analysis);
```

说明：需在 Electron 主进程调用。实例内部会等待 `app.whenReady()`。

### 使用环境变量

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

## 配置

基于 `.env`（可选）：

```env
ai_base_url=https://ark.cn-beijing.volces.com/api/v3
ai_api_key=你的火山引擎方舟 API Key
ai_model=doubao-seed-2-0-mini-260428
AI_PROMPT=请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。
```

或直接设置环境变量。

| 变量 | 说明 |
| --- | --- |
| `ai_base_url` | 方舟 Responses API 地址 |
| `ai_api_key` | API Key |
| `ai_model` | 视觉模型 ID |
| `AI_PROMPT` | 随图片发送的提示词 |

说明：当 `createClient()` 未传 `credentials` / `config` 时，会从 `.env` 或环境变量读取。

## 输出

- 默认输出目录：当前工作目录下的 `aicapture/`
- 通过 `client.captureAndAnalyze({ imgDir })` 自定义
