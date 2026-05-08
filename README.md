# AIcapture

AIcapture 是一个轻量的 Electron 截图分析工具。每次运行都会弹出一次性透明框选层，用户拖拽选择截图范围后，工具将选区截图发送到火山引擎方舟 Responses API，并把分析结果打印到终端。

## 功能

- 无主窗口、无托盘、无设置页，仅保留一次性截图选区覆盖层
- 拖拽选择截图范围，并自动保存本次选区截图到 `src/img/`
- 使用火山引擎方舟 `/responses` 协议发送图片和提示词
- 只需要 4 个配置项：`ai_base_url`、`ai_api_key`、`ai_model`、`AI_PROMPT`

## 快速开始

### 安装依赖

```powershell
pnpm install
```

### 配置

基于 `.env.example` 创建本地 `.env`：

```env
ai_base_url=https://ark.cn-beijing.volces.com/api/v3
ai_api_key=你的火山引擎方舟 API Key
ai_model=doubao-seed-2-0-mini-260428
AI_PROMPT=请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。
```

也可以直接设置环境变量：

```powershell
$env:ai_base_url="https://ark.cn-beijing.volces.com/api/v3"
$env:ai_api_key="你的火山引擎方舟 API Key"
$env:ai_model="doubao-seed-2-0-mini-260428"
$env:AI_PROMPT="请分析这张屏幕截图的主要内容，指出关键界面、文本、问题或下一步建议。"
pnpm capture
```

### 运行

```powershell
pnpm capture
```

## 配置项

| 变量 | 说明 |
|------|------|
| `ai_base_url` | 火山引擎方舟 API 地址，例如 `https://ark.cn-beijing.volces.com/api/v3` |
| `ai_api_key` | 火山引擎方舟 API Key |
| `ai_model` | 视觉模型 ID，例如 `doubao-seed-2-0-mini-260428` |
| `AI_PROMPT` | 发送给 AI 的截图分析提示词 |

## 项目结构

```text
AIcapture/
├── src/
│   ├── main/
│   │   ├── index.js                  # 框选截图 -> AI -> 输出 -> 退出
│   │   └── tools/
│   │       ├── aiClient.js           # 读取 4 项配置并调用 Responses API
│   │       └── captureScreen.js      # 临时覆盖层选区与截图裁剪
│   └── static/icons/                 # 应用图标
├── .env.example
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## 打包

```powershell
pnpm build
```

截图会保存到 `src/img/`，该目录默认被 git 忽略。
