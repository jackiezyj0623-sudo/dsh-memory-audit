/**
 * Pure auditing logic for memory / context snapshots.
 *
 * Kept free of DSH and Cordis imports so it can be unit-tested and reused
 * without a running harness. The plugin entry point (index.ts) is a thin
 * adapter that exposes this logic as a model-facing tool.
 */

/** The five context slots that a resumable long-running task should retain. */
export const REQUIRED_SLOTS = [
  'file_names',
  'task_constraints',
  'goal',
  'completed_steps',
  'next_phase',
] as const

export type SlotName = (typeof REQUIRED_SLOTS)[number]

/**
 * Look up a key in the flattened map, matching either an exact key or the
 * trailing segment of a nested key (e.g. "goal" matches "context.goal").
 */
const lookup = (
  flat: Map<string, { key: string; value: unknown }>,
  name: string,
): { key: string; value: unknown } | undefined => {
  const exact = flat.get(name.toLowerCase())
  if (exact && !isBlank(exact.value)) return exact
  for (const [flatKey, entry] of flat) {
    const tail = flatKey.split('.').pop()
    if (tail === name.toLowerCase() && !isBlank(entry.value)) return entry
  }
  return undefined
}

/** Aliases observed in real memory stores (e.g. Mem0) that drift from the canonical slot name. */
export const SLOT_ALIASES: Record<SlotName, readonly string[]> = {
  file_names: ['files', 'filenames', 'fileNames', 'file_list', 'artifacts'],
  task_constraints: ['constraints', 'requirements', 'rules', 'taskRules', 'limits'],
  goal: ['objective', 'target', 'purpose', 'aim', 'intent'],
  completed_steps: ['done', 'finished', 'progress', 'completedSteps', 'history'],
  next_phase: ['next_steps', 'nextSteps', 'todo', 'pending', 'remaining', 'upnext'],
}

export interface AuditFinding {
  /** Canonical slot this finding refers to. */
  slot: SlotName
  /** ok | missing | drifted */
  status: 'ok' | 'missing' | 'drifted'
  /** Which key actually carried the value, if not the canonical one. */
  foundAs?: string
  /** Human-readable hint for the model / developer. */
  hint: string
}

export interface AuditReport {
  overallStatus: 'complete' | 'partial' | 'incomplete'
  /** 0..1 — share of canonical slots present after alias resolution. */
  contextCoverage: number
  /** Number of slots found under a drifting alias. */
  driftCount: number
  findings: AuditFinding[]
  summary: string
}

const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

/**
 * Flatten a possibly nested memory object into a lowercase key -> raw value map.
 * Only one level of nesting is traversed, which is enough for the flat and
 * semi-structured records produced by typical memory layers.
 */
const flatten = (input: Record<string, unknown>): Map<string, { key: string; value: unknown }> => {
  const map = new Map<string, { key: string; value: unknown }>()
  for (const [key, value] of Object.entries(input)) {
    map.set(key.toLowerCase(), { key, value })
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        const dotted = `${key}.${innerKey}`.toLowerCase()
        if (!map.has(dotted)) map.set(dotted, { key: `${key}.${innerKey}`, value: innerValue })
      }
    }
  }
  return map
}

/**
 * Audit a memory/context snapshot for the five resumable-task slots.
 * Alias resolution means a value stored as `files` is reported as `drifted`
 * but still counted toward coverage — mirroring the Mem0 finding that task
 * semantics can be recovered even when field names drift.
 */
export function auditMemorySnapshot(snapshot: Record<string, unknown>): AuditReport {
  const flat = flatten(snapshot)
  const findings: AuditFinding[] = []
  let present = 0
  let drifted = 0

  for (const slot of REQUIRED_SLOTS) {
    const exact = lookup(flat, slot)
    if (exact) {
      present += 1
      findings.push({
        slot,
        status: exact.key.toLowerCase() === slot ? 'ok' : 'drifted',
        foundAs: exact.key.toLowerCase() === slot ? undefined : exact.key,
        hint:
          exact.key.toLowerCase() === slot
            ? `"${slot}" is present and non-empty.`
            : `Canonical "${slot}" found nested at "${exact.key}".`,
      })
      if (exact.key.toLowerCase() !== slot) drifted += 1
      continue
    }

    let aliasHit: { key: string; value: unknown } | undefined
    for (const name of SLOT_ALIASES[slot]) {
      aliasHit = lookup(flat, name)
      if (aliasHit) break
    }

    if (aliasHit) {
      present += 1
      drifted += 1
      findings.push({
        slot,
        status: 'drifted',
        foundAs: aliasHit.key,
        hint: `Semantics found under "${aliasHit.key}" — drift from canonical "${slot}". Normalize before downstream use.`,
      })
      continue
    }

    findings.push({
      slot,
      status: 'missing',
      hint: `No value for "${slot}" (checked aliases: ${SLOT_ALIASES[slot].join(', ')}). Task resumption may lose this context.`,
    })
  }

  const contextCoverage = present / REQUIRED_SLOTS.length
  const overallStatus: AuditReport['overallStatus'] =
    present === REQUIRED_SLOTS.length
      ? drifted === 0
        ? 'complete'
        : 'partial'
      : present === 0
        ? 'incomplete'
        : 'partial'

  const summary =
    overallStatus === 'complete'
      ? `All ${REQUIRED_SLOTS.length} slots present; ${drifted} drifted field name(s) detected.`
      : `Coverage ${(contextCoverage * 100).toFixed(0)}% (${present}/${REQUIRED_SLOTS.length}); ${drifted} drifted, ${REQUIRED_SLOTS.length - present} missing.`

  return { overallStatus, contextCoverage, driftCount: drifted, findings, summary }
}
