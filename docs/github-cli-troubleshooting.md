# GitHub CLI 现存问题核查、修复与操作记录

## 1. 背景

- 项目：`NotSleeply/AIcapture`
- 仓库：`https://github.com/NotSleeply/AIcapture`
- 本地路径：`D:\Code\AIcapture`
- 日期：2026-05-28
- 目标：使用 GitHub CLI（`gh`）核查仓库当前 GitHub 侧现存问题，逐一定位并修复可修复项，同时记录问题详情、排查思路、修复命令与验证流程。

## 2. 核查范围

本次通过 GitHub CLI 覆盖以下来源：

1. GitHub Issues
2. Pull Requests
3. GitHub Actions 最近运行结果
4. Dependabot alerts
5. Code scanning alerts
6. Secret scanning alerts
7. 本地分支与依赖状态

## 3. GitHub CLI 基础状态

### 3.1 版本检查

```powershell
gh --version
```

结果：

```text
gh version 2.83.1 (2025-11-13)
https://github.com/cli/cli/releases/tag/v2.83.1
```

结论：GitHub CLI 已安装并可正常运行。

### 3.2 登录与权限检查

```powershell
gh auth status
```

结果摘要：

```text
github.com
  ✓ Logged in to github.com account NotSleeply (keyring)
  - Active account: true
  - Git operations protocol: ssh
  - Token scopes: 'admin:public_key', 'gist', 'read:org', 'repo'
```

结论：当前已登录 `NotSleeply`，具备仓库访问与常规维护权限。

### 3.3 仓库访问检查

```powershell
gh repo view --json nameWithOwner,viewerPermission,defaultBranchRef,url
```

结果：

```json
{
  "defaultBranchRef": { "name": "main" },
  "nameWithOwner": "NotSleeply/AIcapture",
  "url": "https://github.com/NotSleeply/AIcapture",
  "viewerPermission": "ADMIN"
}
```

结论：当前账号对仓库具备 `ADMIN` 权限。

## 4. 现存问题核查

### 4.1 Issues 与 PR

命令：

```powershell
gh issue list --state open --limit 100 --json number,title,state,labels,assignees,updatedAt,url
gh issue list --state all --limit 100 --json number,title,state,labels,assignees,updatedAt,url
gh pr list --state open --limit 100 --json number,title,state,headRefName,baseRefName,updatedAt,url
```

结果：

```json
[]
```

结论：仓库当前没有 GitHub Issues，也没有打开状态的 PR。

### 4.2 GitHub Actions

命令：

```powershell
gh run list --limit 20 --json databaseId,status,conclusion,name,event,headBranch,createdAt,url
```

关键结果：

```json
[
  {
    "databaseId": 26541779914,
    "name": "CI",
    "headBranch": "main",
    "status": "completed",
    "conclusion": "failure",
    "createdAt": "2026-05-27T22:11:32Z",
    "url": "https://github.com/NotSleeply/AIcapture/actions/runs/26541779914"
  }
]
```

结论：最新 `main` 分支 CI 失败，这是本次确认的主要现存问题。

### 4.3 Dependabot alerts

命令：

```powershell
gh api 'repos/NotSleeply/AIcapture/dependabot/alerts?state=open' --jq 'length'
```

结果：

```text
0
```

结论：当前没有打开状态的 Dependabot alerts。历史 Dependabot alerts 均为 `fixed` 状态。

### 4.4 Code scanning alerts

命令：

```powershell
gh api repos/NotSleeply/AIcapture/code-scanning/alerts
```

结果：

```text
gh: no analysis found (HTTP 404)
```

结论：仓库当前没有可查询的 Code scanning analysis。该项没有发现可修复告警。

### 4.5 Secret scanning alerts

命令：

```powershell
gh api repos/NotSleeply/AIcapture/secret-scanning/alerts
```

结果：

```text
gh: Secret scanning is disabled on this repository. (HTTP 404)
```

结论：Secret scanning 未启用，无法通过该接口核查告警；本次没有发现可修复的 secret scanning 问题。

## 5. 问题详情：CI 构建失败

### 5.1 失败运行

- Workflow：`CI`
- Run ID：`26541779914`
- Branch：`main`
- Commit：`29c3731961543a97287025b1a9e81d3e11ada1a9`
- Job：`build`
- 失败步骤：`Build`
- URL：`https://github.com/NotSleeply/AIcapture/actions/runs/26541779914`

查看失败详情：

```powershell
gh run view 26541779914 --json databaseId,name,status,conclusion,event,headBranch,headSha,jobs,url
gh run view 26541779914 --log-failed
```

### 5.2 失败日志

关键日志：

```text
> aicapture@1.0.2 build /home/runner/work/AIcapture/AIcapture
> tsup

DTS Build start
error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
Visit https://aka.ms/ts6 for migration information.

Error: error occurred in dts build
ELIFECYCLE Command failed with exit code 1.
```

### 5.3 排查思路

1. 先通过 `gh run list` 发现最新 `main` 分支 CI 失败。
2. 使用 `gh run view --log-failed` 获取失败 job 日志。
3. 日志显示失败发生在 `pnpm build` 的 `tsup` DTS 生成阶段。
4. 错误为 TypeScript 6 的 `TS5101`：`baseUrl` 已弃用，需要设置 `ignoreDeprecations: "6.0"`。
5. 本地第一次执行 `pnpm build` 曾通过，原因是本地 `node_modules` 中 TypeScript 仍为 `5.9.3`，与 CI fresh install 不一致。
6. 执行 `pnpm install --frozen-lockfile` 后，本地依赖对齐 lockfile，TypeScript 升级到 `6.0.3`，成功复现 CI 失败。

### 5.4 本地复现命令

```powershell
pnpm exec tsc --version
pnpm install --frozen-lockfile
pnpm exec tsc --version
pnpm build
```

复现过程中的版本变化：

```text
- typescript 5.9.3
+ typescript 6.0.3
```

复现后的错误：

```text
error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

## 6. 修复方案

### 6.1 修改文件

文件：`tsconfig.json`

修改内容：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "ignoreDeprecations": "6.0",
    "noEmit": true
  },
  "include": ["src"]
}
```

### 6.2 修复原因

TypeScript 6 将部分 6.0 阶段的弃用项提升为可报错诊断。`tsup` 在生成 DTS 时触发了内部或派生配置中的 `baseUrl` 诊断。根据错误提示，添加：

```json
"ignoreDeprecations": "6.0"
```

可显式接受 TypeScript 6.0 阶段的弃用兼容窗口，从而恢复 DTS 构建。

## 7. 修复后验证

### 7.1 确认 TypeScript 版本

```powershell
pnpm exec tsc --version
```

结果：

```text
Version 6.0.3
```

### 7.2 执行构建

```powershell
pnpm build
```

结果摘要：

```text
> aicapture@1.0.2 build D:\Code\AIcapture
> tsup

CJS Build success
ESM Build success
DTS Build success
dist\index.d.ts
dist\index.d.cts
```

结论：在 TypeScript `6.0.3` 环境下，`pnpm build` 已通过，CI 中的 `TS5101` 失败已在本地修复验证。

## 8. 最终问题清单与处理状态

| 来源 | 问题 | 状态 | 处理 |
| --- | --- | --- | --- |
| GitHub Issues | 无打开 Issues | 无需处理 | 已核查 |
| Pull Requests | 无打开 PR | 无需处理 | 已核查 |
| GitHub Actions | 最新 `main` CI 失败，`pnpm build` DTS 阶段报 `TS5101` | 已修复本地代码 | `tsconfig.json` 添加 `ignoreDeprecations: "6.0"` |
| Dependabot alerts | 打开状态为 0 | 无需处理 | 已核查 |
| Code scanning | 无 analysis，接口返回 404 | 无可修复项 | 已记录 |
| Secret scanning | 仓库未启用，接口返回 404 | 无法通过接口核查 | 已记录 |

## 9. 后续操作建议

本地修复已完成，但 GitHub Actions 需要在修复提交推送到远端后重新运行才会更新状态。

建议后续流程：

```powershell
git status --short --branch
git diff -- tsconfig.json docs/github-cli-troubleshooting.md
git add tsconfig.json docs/github-cli-troubleshooting.md
git commit -m "fix: silence TypeScript 6 deprecation during DTS build"
git push
gh run list --limit 5 --json databaseId,status,conclusion,name,headBranch,createdAt,url
```

推送后，确认新的 `CI` run 结果为 `success`。
