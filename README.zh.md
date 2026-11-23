# dsh-memory-audit

> 在 Agent 恢复的记忆里揪出上下文丢失和字段名漂移——趁它还没毁掉一个长任务。

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件，审计记忆/上下文快照中可恢复任务所需的五个关键槽位，并报告缺失的上下文与字段名漂移。

## 背景

Mem0 这类记忆层能恢复被中断任务的*语义*，但字段名仍会漂移（`files` vs `file_names`、`next_steps` vs `next_phase`）。这种漂移是静默的：上下文看似恢复，但读取规范字段的下游代码看到的却是空洞。本插件让这个失败模式对模型和开发者都可见。

它来自一项对照实验：把五个上下文字段注入记忆层，在三阶段任务恢复实验中验证。语义恢复率达 100%，但代码层面字段名出现漂移——这个缺口正是本工具要审计的。

## 检查项

| 规范槽位 | 可接受的别名 |
| --- | --- |
| `file_names` | `files`, `filenames`, `fileNames`, `file_list`, `artifacts` |
| `task_constraints` | `constraints`, `requirements`, `rules`, `taskRules`, `limits` |
| `goal` | `objective`, `target`, `purpose`, `aim`, `intent` |
| `completed_steps` | `done`, `finished`, `progress`, `completedSteps`, `history` |
| `next_phase` | `next_steps`, `nextSteps`, `todo`, `pending`, `remaining`, `upnext` |

嵌套键会按末段解析，因此 `context.goal` 可满足 `goal` 槽位。

## 提供的工具

- **`audit_memory_context`** — 接收 `snapshot` 对象，返回结构化报告：`overallStatus`（`complete` / `partial` / `incomplete`）、`contextCoverage`（0–1）、`driftCount`、逐槽位 `findings` 和可读的 `summary`。
- **`list_memory_slots`** — 返回规范槽位，便于设计抗漂移的记忆 schema。

## 安装

在 DSH 仓库检出的环境中：

```sh
git clone https://github.com/YOUR_USERNAME/dsh-memory-audit.git
cd dsh-memory-audit
npm install --legacy-peer-deps
npm run build
```

通过 patch 覆盖层（`cordis.yml`）加入 Web profile：

```yaml
- insert:
    - id: memory-audit
      name: /absolute/path/to/dsh-memory-audit/lib/index.js
```

然后启动：

```sh
pnpm dsh web --patch /absolute/path/to/dsh-memory-audit/cordis.yml
```

## 开发

```sh
npm run build   # 编译 src/ -> lib/
npm test        # 运行纯逻辑测试（无需 harness）
```

`src/audit.ts` 中的审计逻辑不依赖 DSH，且有完整单元测试。`src/index.ts` 是向 harness 注册工具的薄适配层。

## 许可证

MIT
