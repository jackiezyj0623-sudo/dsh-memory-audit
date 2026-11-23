import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { auditMemorySnapshot, REQUIRED_SLOTS } from './audit.js'

export const name = 'memory-audit'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'audit_memory_context',
      description:
        'Audit a memory or context snapshot for the five slots needed to resume an interrupted task: file names, task constraints, goal, completed steps, and next phase. Reports coverage, missing slots, and field-name drift (e.g. "files" instead of "file_names"). Use after restoring memory or before handing a long task to another agent.',
      parameters: {
        snapshot: {
          type: 'object',
          required: true,
          description: 'The memory/context record to audit, as a JSON object.',
          additionalProperties: true,
        },
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            overallStatus: { type: 'string' },
            contextCoverage: { type: 'number' },
            driftCount: { type: 'number' },
            findings: { type: 'array' },
            summary: { type: 'string' },
          },
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: 'text',
            text: [
              `Memory audit: ${value.summary}`,
              ...value.findings.map(
                (f: { slot: string; status: string; foundAs?: string; hint: string }) =>
                  `  - ${f.slot}: ${f.status}${f.foundAs ? ` (found as ${f.foundAs})` : ''} — ${f.hint}`,
              ),
            ].join('\n'),
          },
        ],
      },
      async execute(args) {
        return auditMemorySnapshot(args.snapshot as Record<string, unknown>) as never
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'list_memory_slots',
      description:
        'List the canonical context slots and their accepted aliases used by audit_memory_context. Useful for designing a memory schema that avoids field-name drift.',
      parameters: {},
      output: {
        schema: { type: 'array' },
        render: (_args, value) => [
          {
            type: 'text',
            text: `Canonical slots: ${REQUIRED_SLOTS.join(', ')}. Current tool version: value is the slot list.`,
          },
        ],
      },
      async execute() {
        return REQUIRED_SLOTS as never
      },
    }),
  )
}
