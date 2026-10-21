# 变更日志

本文件记录项目中可复用的产品行为和运行时集成变更。设计背景与详细协议请参阅对应的 spec 文档。

## 2026-10-21

### 合并原始仓库 main

- 上游：`zai-org/ZCode`，合入 `aac47556`、`0a1fc56d`、`3c5b2276`，版本从 `3.14.3` 更新为 `3.16.2`。合并前 fork 基线为 `ddeb790`；10 月 21 日再次核对上游 main 仍为 `3c5b2276`。
- 逐项解决 15 个文件的三方合并冲突，保留 fork 的 GitHub Releases 更新源、发布版本覆盖、产品命名、界面定制和外部 Computer Use Helper 接线。
- 官方插件统一使用上游 `apps/zcode-cli/packages/*-plugin`，移除 12 个旧目录副本及旧发现路径，避免同名 workspace 包与重复 staging。
- 保留 GitHub Issues 问题上报、隐藏社区/需求入口和 Z.ai 登录的既有行为，同时接入上游漏洞上报入口；相应上游测试按 fork 规则整合。
- 修复整合后的构建缓存遗漏：`ZCODE_APP_VERSION` 纳入桌面 E2E 构建指纹，避免版本变化后复用旧产物。

### 验证与限制

- 环境：Windows，Node `24.14.0`，pnpm `10.33.2`；`pnpm install --frozen-lockfile` 成功。
- `pnpm typecheck` 通过；`pnpm lint` 为 99 个警告、0 个错误；`pnpm architecture:check --changed` 为 0 个违规。合并前 Lint 为 82 个警告、0 个错误。
- `pnpm --dir apps/zcode-cli typecheck` 通过（32 个任务）；CLI Lint 为 0 个错误、70 个警告，另有 13 个原样上游行数诊断。Windows 下执行 CLI 命令时将根 `node_modules/.bin` 加入当前进程 PATH。
- 根定向单测共 128 项通过，涉及 `workspaceHelpMenuButton`、`loginDialogProviders`、`modelProviderNavigationLoading`、`modelProviderNavigationI18n`、`workspaceSidebarFooterUsageSummaryEntitlement`、`workspaceSidebarFooterWebRemoteControlTooltip`、`autoUpdaterReadyState`、`e2eDesktopBuildCache`。命令为 `pnpm exec vitest run <对应 packages/ui/test 或 packages/desktop/test 文件>`。
- CLI 插件定向单测 23 项通过、3 项失败：`bundled-plugins-resilience.test.ts` 的 2 项缓存诊断断言在恢复原样上游实现后仍失败；`official-plugin-runtime.test.ts` 的 1 项断言因 Windows 路径中 `/` 与 `\\` 表示不同而失败，相关实现和测试均未修改。另运行 `official-plugin-seed-lock.test.ts`、`official-plugin-cache-fs.test.ts` 通过。未将这些失败记为通过。
- `pnpm --filter @zcode/desktop typecheck:e2e` 通过；修改的 E2E 文件 Lint 为 0 个警告、0 个错误。
- 桌面帮助菜单 E2E 最终为 1 项通过、2 项失败：VR-02 窄窗、中英文及深浅主题通过；VR-01 刷新后工作区未就绪，诊断显示登录页；VR-03 冷缓存占位的 `aria-disabled` 预期为 `true`、实际为 `null`。失败原因尚未确认，不能据此判定均为上游或环境问题。运行记录为 `desktop-e2e-20261021003444818-p31448-e9d6c8de0c10bff3`，报告位于 `packages/desktop/.e2e-artifacts/<运行记录>/summary.md`。测试保留 pending 状态，未转正。
- E2E 复现：先设置 `E2E_PROVIDER_HTTP_MODE=replay`，将 `E2E_PROVIDER_REPLAY_FIXTURE_PATH` 设为 `packages/desktop/test/e2e/fixtures/upstream/common.json` 的绝对路径，再执行 `pnpm --filter @zcode/desktop test:e2e -- --spec test/e2e/manual-review/pending/help-report-vulnerability.test.ts`。默认 capture 首轮因缺少 `E2E_PROVIDER_BASE_URL` 在测试前失败，未计入通过结果。
- 未执行全量单测、完整跨平台打包或真实 Computer Use 原生交互验证。原样合入的上游文件包含空白诊断，未全仓格式化；本次相对上游的整合差异通过 `git diff --check FETCH_HEAD`。

详细范围：[`2026-10-20-upstream-main-merge.md`](superpowers/specs/2026-10-20-upstream-main-merge.md)。

## 2026-09-22

### Computer Use broker runtime 恢复

- 合并提交：`aa342d5 feat(cua): restore broker runtime integration`。
- `@zcode/zcode-cua` 从始终返回 unavailable，恢复为通过 `ZCODE_CUA_PERMISSION_BROKER_SOCKET` 连接官方 Computer Use Helper 的 NDJSON IPC v2 broker。
- 增加认证、请求 ID 校验、响应解析、超时、断线、非法 JSON 和 broker 错误的 fail-closed 处理。
- `createComputerUseRuntime()` 将 node_repl 的工具调用转发为官方 Helper 方法，并保留 MCP `content` 与结构化结果。
- Desktop Windows 运行时继续从安装目录的 `resources/tools/cua-helper` 解析 Helper manifest、脚本入口和 native addon；官方 Helper 文件未复制进开源仓库。
- 源码构建新增 `prepare:cua-helper`：Windows 开发机可从 `ZCODE_CUA_HELPER_SOURCE` 或默认官方安装路径 staging Helper，`pnpm dev:desktop` 会自动设置 `ZCODE_CUA_DEV_ROOT`；Windows 打包会将 staging 目录放入 `resources/tools/cua-helper`。
- 已验证：官方 Helper 启动、`authenticate`、`broker_info`、`controller_status`、`permission_status`、`list_applications` 以及 runtime wrapper 的真实调用。

### 已知限制

- `list_windows`、`capture_app` 和输入动作还依赖 Windows UI Automation 的桌面会话、窗口可见性及 UAC 完整性级别；管理员账户不等于所有进程都以管理员令牌运行。
- 验证时应让 ZCode、Helper 和目标应用处于同一交互桌面及兼容的完整性级别，避免使用管理员 PowerShell 启动普通目标应用。
- 全仓 lint 仍存在与本次改动无关的历史错误；类型检查和架构检查已通过。

详细设计：[`docs/superpowers/specs/2026-09-22-cua-runtime-recovery.md`](superpowers/specs/2026-09-22-cua-runtime-recovery.md)
