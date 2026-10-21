# 同步上游 main（2026-10-20）

## 范围与规则

- 将 `zai-org/ZCode` 的 `main` 合并到当前 fork，保留双亲提交历史。
- 合并前本地基线为 `ddeb790`；抓取时上游目标为 `3c5b227649371507ddc4eb46ac5133afe6db1cab`。
- 采用上游新增功能及接口，保留 fork 的 GitHub Releases 更新源、产品命名、发布流程、界面定制、内置插件及 Computer Use broker 接线。
- 冲突按当前接口逐项整合，不整体覆盖任一方。上游删除或迁移的模块不为兼容旧路径而恢复。
- 官方 Computer Use native Helper 继续属于外部安装运行时，不向仓库复制二进制或内部 bundle。
- 官方插件统一采用上游 `apps/zcode-cli/packages/*-plugin` 的源码和版本，移除根 `packages/*-plugin` 的旧副本，避免 workspace 包名冲突和旧缓存路径。
- 保留隐藏 Z.ai 登录、隐藏社区和需求入口、问题上报跳转 fork GitHub Issues 的既有规则；保留上游新增漏洞上报入口。
- 帮助菜单 E2E 使用漏洞入口之后仍保留的资源管理器项验证布局稳定，避免依赖已隐藏的需求入口。
- `ZCODE_APP_VERSION` 继续覆盖构建版本；桌面 E2E 构建缓存必须将其纳入指纹，变更版本后不能复用旧产物。

## 所有者与接口

本次同步不新增状态所有者、队列或跨层写入路径。会话运行时、Host 路由及平台服务沿用合并后上游契约；fork 的更新源由 Desktop 更新模块负责，Helper 生命周期和 broker 协议遵循现有 CUA spec。

```text
上游提交 + fork 提交 → Git 三方合并 → 契约与冲突检查 → 验证 → 合并提交
运行时输入 → CommandInbox admission → 会话状态所有者 → 既有协议事件
  Desktop: continuous；手机 Web: replayable，保留各自恢复语义
```

## 验收与失败边界

1. 合并后上游目标和原本地 HEAD 均为 HEAD 的祖先，且无未解决冲突。
2. 保留 fork 的发布配置、更新源和 CUA 运行时接线，按新上游接口消除失效引用。
3. 根据合并后清单同步依赖，执行 `pnpm typecheck`、`pnpm lint` 和 `pnpm architecture:check --changed`。
4. 对手动冲突处理涉及的模块运行实际存在的针对性测试；无法执行的交互验证明确记录为未验证。
5. 区分合并前已有问题、上游问题和冲突处理引入的问题；不将检查失败记为通过。
6. 验证结果写入 `docs/CHANGELOG.md`。本次操作完成本地合并，不自动发布安装包。

## 2026-10-21 发布前准入补充

用户随后授权推送 main 并通过版本标签发布。真实 pre-push 以远端 `ddeb790` 为基线，发现 18 个本次上游新增源码尚未包含在公开架构快照中。逐项核对它们在 `3c5b227649371507ddc4eb46ac5133afe6db1cab` 的路径、Git blob 和文件模式与当前暂存区及工作区一致后，仅补充 `scripts/architecture/upstream-snapshot.json` 的固定内容与 introduced 清单。保留后续本地修改必须登记模块的规则，不更改检查器、比较基线或 managed 模块规则。
