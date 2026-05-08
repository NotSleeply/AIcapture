# AIcapture

AIcapture 是一个可发布为 npm 包的 Electron 截图分析工具。它采用实例化调用方式：在 Electron 主进程里创建客户端实例后即可完成「截图选区 + AI 分析」。

## 特性

- 无主窗口、无托盘、无设置页，仅保留一次性截图选区覆盖层
- 拖拽选择截图范围，并自动保存本次选区截图到工作目录的 `aicapture/`
- 使用火山引擎方舟 `/responses` 协议发送图片和提示词
- 只需要 4 个配置项：`ai_base_url`、`ai_api_key`、`ai_model`、`AI_PROMPT`

## 要求

- Node.js >= 18
- Electron >= 28（peer dependency）

## 安装

```bash
npm install aicapture electron
```

## 使用

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

说明：需在 Electron 主进程调用。若 `app` 尚未 ready，内部会自动等待。

### 使用环境变量

```ts
import { createClient } from "aicapture";

const client = createClient();
const result = await client.captureAndAnalyze();
```

## Client API

- `createClient(options)`：创建实例，统一注入配置与默认参数。
- `client.captureAndAnalyze(options)`：一站式完成截图 + AI 分析。
- `client.captureSelectedRegion(options)`：仅做截图选区与裁剪。
- `client.analyzeImage({ base64Image, mimeType })`：仅发送图片进行分析。

## 配置

基于 `.env.example` 创建本地 `.env`（可选）：

```env
ai_base_url=https://ark.cn-beijing.volces.com/api/v3
ai_api_key=你的火山引擎方舟 API Key
ai_model=doubao-seed-2-0-mini-260428
AI_PROMPT=请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。
```

也可以直接设置环境变量（可选）：

```powershell
$env:ai_base_url="https://ark.cn-beijing.volces.com/api/v3"
$env:ai_api_key="你的火山引擎方舟 API Key"
$env:ai_model="doubao-seed-2-0-mini-260428"
$env:AI_PROMPT="请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。"
```

| 变量 | 说明 |
|------|------|
| `ai_base_url` | 火山引擎方舟 API 地址，例如 `https://ark.cn-beijing.volces.com/api/v3` |
| `ai_api_key` | 火山引擎方舟 API Key |
| `ai_model` | 视觉模型 ID，例如 `doubao-seed-2-0-mini-260428` |
| `AI_PROMPT` | 发送给 AI 的截图分析提示词 |

说明：当 `createClient()` 未传 `credentials` / `config` 时，会自动从 `.env` 或环境变量读取。

## 输出

- 默认输出目录：当前工作目录下的 `aicapture/`
- 目录可通过 `client.captureAndAnalyze({ imgDir })` 自定义

## 开发

```powershell
pnpm install
pnpm build
```

## 项目结构

```text
AIcapture/
├── src/
│   ├── aiClient.ts                   # 读取 4 项配置并调用 Responses API
│   ├── captureScreen.ts              # 临时覆盖层选区与截图裁剪
│   └── index.ts                      # npm 包入口
├── tsup.config.ts                    # 构建配置（ESM + CJS + types）
├── tsconfig.json
├── .env.example
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## 贡献

欢迎提交 Issue / PR。详细流程请查看 [CONTRIBUTING.md](./docs/CONTRIBUTING.md)。

## 许可

ISC License. See [LICENSE](LICENSE).
