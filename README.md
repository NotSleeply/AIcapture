# AIcapture

AIcapture 是一款基于 **Electron** 的智能桌面截图工具，集成 AI 能力，可直接对截取的屏幕内容进行智能分析。无需后端服务，**纯前端运行**，开箱即用。

## 主要功能

- **一键/区域截图** — 支持全局快捷键截图和区域框选
- **AI 智能分析** — 截图后自动弹出 AI 分析窗口，支持多轮追问
- **多 AI 提供商支持** — 内置 DeepSeek、OpenAI（GPT-4o）、豆包（火山引擎）三种选择
- **前端直接调用 API** — 无需部署任何后端服务，配置 API Key 即可使用
- **视觉理解** — OpenAI 和豆包支持图片直接理解分析
- **可打包安装** — 支持打包为 Windows 可执行安装包

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 cnpm
- 一个 AI 服务商的 API Key（DeepSeek / OpenAI / 豆包 任选其一）

### 安装与运行

```powershell
# 克隆仓库
git clone https://github.com/<your-username>/AIcapture.git
cd AIcapture

# 安装依赖
cd Capture
npm install

# 启动开发模式
npm run dev

# 打包为安装包
npm run build
```

## 使用说明

### 1. 配置 AI 服务

启动应用后，在主窗口点击「**配置**」面板：

1. **选择 AI 提供商**
   - `DeepSeek`（推荐）— 性价比高，超长上下文，仅文本对话
   - `OpenAI`（GPT-4o）— 功能全面，支持图片视觉分析
   - `豆包（火山引擎）`— 国产大模型，视觉能力优秀

2. **填写 API Key** — 对应提供商的密钥

3. **可选配置**
   - Base URL：自定义 API 地址（留空使用默认值）
   - 模型 ID：豆包用户可指定具体模型

4. 点击「**保存配置**」，建议点击「**测试连接**」确认可用

### 2. 截图与分析

- 点击「**开始截图**」或使用快捷键（默认 `Alt + S`）
- 框选区域后自动弹出 AI 分析窗口
- AI 自动对截图内容进行详细分析
- 可在输入框中继续提问，支持多轮对话

### 3. 其他设置

| 功能 | 说明 |
|------|------|
| 截图时隐藏当前窗口 | 截图时自动隐藏应用窗口 |
| 截图时开启AI分析 | 截图完成后自动打开AI分析窗口 |
| 自定义快捷键 | 可修改截图快捷键 |

## 支持的 AI 提供商详情

### DeepSeek
- 默认模型：`deepseek-chat`
- API 地址：`https://api.deepseek.com`
- 特点：性价比高，不支持直接图片分析（会提示切换提供商）

### OpenAI
- 默认模型：`gpt-4o-mini`（视觉模型：`gpt-4o`）
- API 地址：`https://api.openai.com/v1`
- 特点：功能全面，支持图片直接视觉分析

### 豆包（火山引擎）
- 默认模型：`doubao-lite-32k-250115`
- 视觉模型：`doubao-1-5-vision-pro-32k-250115`
- API 地址：火山引擎方舟控制台获取
- 特点：国产大模型，视觉能力优秀

## 项目结构

```
AIcapture/
├── Capture/                  # Electron 前端主程序
│   ├── main/                 # 主进程代码
│   │   ├── index.js          # 应用入口与窗口管理
│   │   └── capture.js        # 截图逻辑与IPC处理
│   ├── renderer/             # 渲染进程页面
│   │   ├── index.html        # 主窗口（配置面板）
│   │   └── dialog.html       # AI分析对话框
│   ├── static/
│   │   ├── js/               # 前端JS
│   │   │   ├── tools/
│   │   │   │   ├── aiClient.js     # AI客户端（多提供商支持）
│   │   │   │   └── ...
│   │   │   ├── index.js      # 主窗口交互逻辑
│   │   │   └── dialog.js     # AI分析对话框逻辑
│   │   └── css/              # 样式文件
│   └── preloader/            # Electron preload脚本
├── CONTRIBUTING.md
├── LICENSE                   # MIT License
└── README.md
```

## 技术栈

| 技术 | 用途 |
|------|------|
| Electron | 桌面应用框架 |
| electron-screenshots | 截图组件 |
| OpenAI Compatible API | 统一AI接口协议 |
| localStorage | 本地配置持久化 |

## 安全提示

- API Key 存储在本地 localStorage 中，不会上传到任何服务器
- 请勿将含有 API Key 的配置分享给他人
- 推荐使用具有权限限制的 API Key

## 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 贡献

欢迎贡献！请参阅 `CONTRIBUTING.md`，Fork 仓库 -> 新分支 -> 提交 PR。
