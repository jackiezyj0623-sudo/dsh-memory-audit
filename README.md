# dsh-memory-audit

> Catch context loss and field-name drift in an agent's restored memory — before it derails a long-running task.

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that audits a memory / context snapshot for the five slots a resumable task needs, and reports both missing context and field-name drift.

## Why

Memory layers such as Mem0 can recover the *semantics* of an interrupted task while still drifting on field names (`files` vs `file_names`, `next_steps` vs `next_phase`). That drift is silent: the context looks restored, but downstream code reading canonical keys sees holes. This plugin makes that failure mode visible, both to the model and to the developer.

It was built from a controlled study in which five context slots were injected into a memory layer and recovered across a three-stage task-resumption experiment. Semantic recovery reached 100%, yet code-level field names drifted — the gap this tool audits.

## What it checks

| Canonical slot | Accepted aliases |
| --- | --- |
| `file_names` | `files`, `filenames`, `fileNames`, `file_list`, `artifacts` |
| `task_constraints` | `constraints`, `requirements`, `rules`, `taskRules`, `limits` |
| `goal` | `objective`, `target`, `purpose`, `aim`, `intent` |
| `completed_steps` | `done`, `finished`, `progress`, `completedSteps`, `history` |
| `next_phase` | `next_steps`, `nextSteps`, `todo`, `pending`, `remaining`, `upnext` |

Nested keys are resolved by trailing segment, so `context.goal` satisfies the `goal` slot.

## Tools exposed

- **`audit_memory_context`** — takes a `snapshot` object, returns a structured report: `overallStatus` (`complete` / `partial` / `incomplete`), `contextCoverage` (0–1), `driftCount`, per-slot `findings`, and a human-readable `summary`.
- **`list_memory_slots`** — returns the canonical slots, useful when designing a drift-resistant memory schema.

## Install

This is a community plugin. From a DSH checkout:

```sh
git clone https://github.com/YOUR_USERNAME/dsh-memory-audit.git
cd dsh-memory-audit
npm install --legacy-peer-deps
npm run build
```

Add it to your Web profile via a patch overlay (`cordis.yml`):

```yaml
- insert:
    - id: memory-audit
      name: /absolute/path/to/dsh-memory-audit/lib/index.js
```

Then launch:

```sh
pnpm dsh web --patch /absolute/path/to/dsh-memory-audit/cordis.yml
```

## Example

Ask the agent:

> Restore the memory snapshot and use audit_memory_context to check what context survived.

Example report:

```
Memory audit: Coverage 80% (4/5); 1 drifted, 1 missing.
  - file_names: drifted (found as files) — Semantics found under "files" — drift from canonical "file_names".
  - task_constraints: ok — "task_constraints" is present and non-empty.
  - goal: ok — "goal" is present and non-empty.
  - completed_steps: ok — "completed_steps" is present and non-empty.
  - next_phase: missing — No value for "next_phase" ... Task resumption may lose this context.
```

## Development

```sh
npm run build   # compile src/ -> lib/
npm test        # run the pure-logic test suite (no harness needed)
```

The audit logic in `src/audit.ts` has no DSH dependency and is fully unit-tested. `src/index.ts` is a thin adapter that registers the tools with the harness.

## Compatibility

Built against the DSH developer-preview plugin API (`cordis` service context + `defineTool`). DSH is in rapid development; verify against your host version and report issues in the repository.

## License

MIT
