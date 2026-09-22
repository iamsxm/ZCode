# 变更日志

本文件记录项目中可复用的产品行为和运行时集成变更。设计背景与详细协议请参阅对应的 spec 文档。

## 2026-09-22

### Computer Use broker runtime 恢复

- 合并提交：`aa342d5 feat(cua): restore broker runtime integration`。
- `@zcode/zcode-cua` 从始终返回 unavailable，恢复为通过 `ZCODE_CUA_PERMISSION_BROKER_SOCKET` 连接官方 Computer Use Helper 的 NDJSON IPC v2 broker。
- 增加认证、请求 ID 校验、响应解析、超时、断线、非法 JSON 和 broker 错误的 fail-closed 处理。
- `createComputerUseRuntime()` 将 node_repl 的工具调用转发为官方 Helper 方法，并保留 MCP `content` 与结构化结果。
- Desktop Windows 运行时继续从安装目录的 `resources/tools/cua-helper` 解析 Helper manifest、脚本入口和 native addon；官方 Helper 文件未复制进开源仓库。
- 已验证：官方 Helper 启动、`authenticate`、`broker_info`、`controller_status`、`permission_status`、`list_applications` 以及 runtime wrapper 的真实调用。

### 已知限制

- `list_windows`、`capture_app` 和输入动作还依赖 Windows UI Automation 的桌面会话、窗口可见性及 UAC 完整性级别；管理员账户不等于所有进程都以管理员令牌运行。
- 验证时应让 ZCode、Helper 和目标应用处于同一交互桌面及兼容的完整性级别，避免使用管理员 PowerShell 启动普通目标应用。
- 全仓 lint 仍存在与本次改动无关的历史错误；类型检查和架构检查已通过。

详细设计：[`docs/superpowers/specs/2026-09-22-cua-runtime-recovery.md`](superpowers/specs/2026-09-22-cua-runtime-recovery.md)
