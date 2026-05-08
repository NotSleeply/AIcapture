# 贡献指南（CONTRIBUTING.md）

感谢你对 AIcapture 的关注与贡献！为让贡献流程高效顺畅，请按以下指南操作。

## 一般流程

1. Fork 本仓库到你的账号。
2. 在本地克隆你的 fork：

```powershell
git clone https://github.com/<your-username>/AIcapture.git
cd AIcapture
```

1. 从主分支拉取最新代码并新建分支：

```powershell
git checkout main
git pull upstream main
git checkout -b feat/your-feature-name
```

1. 在分支上实现变更并添加测试（如适用）。
2. 提交时请使用规范化的提交信息（参见下文）。
3. 推送到你的 fork 并在 GitHub 上发起 Pull Request（PR）。

## 分支与提交规范

- 分支命名建议使用小写短横分隔并包含类型前缀：
  - feat/xxx（新特性）
  - fix/xxx（Bug 修复）
  - docs/xxx（文档）
  - chore/xxx（杂项、构建）

- 提交信息建议使用 Conventional Commits 风格：
  - feat: 增加新功能
  - fix: 修复 bug
  - docs: 文档变更
  - style: 代码格式（不影响功能）
  - refactor: 重构（既不新增功能也不修复 bug）
  - test: 测试相关
  - chore: 构建或其他维护

示例：

```bash
feat: 支持区域截图并保存为 PNG
```

## 代码风格与质量

- 前端（src）建议遵循常见的 JavaScript/TypeScript 风格，项目没有强制 linter 时请保持清晰易读。
- 后端（Python）请遵循 PEP8 风格，推荐使用 black/flake8 做格式化与检查。
- 新增功能应包含单元测试或集成测试（如适用）。

## 本地开发与测试

- 前端（Electron）

```powershell
pnpm install
pnpm dev
```

- 后端（Python）

```powershell
cd .\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt  # 若有
python main.py
```

- 运行测试（若项目包含测试）：

```powershell
# Python
pytest
# Node（若有）
pnpm test
```

## 提交 PR 要求

在创建 PR 时请：

- 关联相关 Issue（若有）。
- 在 PR 描述中说明变更的目的、实现方式以及如何测试。
- 如果涉及破坏兼容性的改动，请在标题或描述中明确说明（并遵循语义化版本策略）。

PR 描述模板示例：

```bash
### 变更说明
- 简要列点说明改动

### 测试说明
- 如何在本地复现/验证

### 相关 Issue
- Fixes #<issue-number>
```

## 代码审查

- 我们会对每个 PR 进行代码审查。请根据审查意见及时更新 PR。
- 大的改动可能会拆分为多个小 PR 以便审查。

## 贡献者行为守则

请遵守项目的 `CODE_OF_CONDUCT.md`。保持尊重、礼貌与专业。

## 报告问题与安全

- 普通 Bug 与功能请求请通过 GitHub Issues 提交。
- 若发现安全漏洞，请不要在 Issue 公共页面公开， 请通过邮件联系仓库管理员：<your-email@example.com>（请替换为实际邮箱）。

## 许可证与版权

提交的贡献将按照本仓库的 LICENSE（当前为 MIT）进行许可。提交代码即表示你同意将贡献以该许可证条款授权给本项目。

---
如果你希望我为仓库创建 PR 模板、Issue 模板或自动化配置（CI、代码格式化工具）我可以继续为你添加。
