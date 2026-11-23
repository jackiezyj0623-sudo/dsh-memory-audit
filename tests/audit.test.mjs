import test from 'node:test'
import assert from 'node:assert/strict'
import { auditMemorySnapshot, REQUIRED_SLOTS } from '../lib/audit.js'

test('canonical snapshot is complete with no drift', () => {
  const report = auditMemorySnapshot({
    file_names: ['a.ts', 'b.ts'],
    task_constraints: 'no network',
    goal: 'fix the bug',
    completed_steps: ['read file'],
    next_phase: 'run tests',
  })
  assert.equal(report.overallStatus, 'complete')
  assert.equal(report.contextCoverage, 1)
  assert.equal(report.driftCount, 0)
  assert.equal(report.findings.length, 5)
})

test('aliased fields count toward coverage but are flagged as drift', () => {
  const report = auditMemorySnapshot({
    files: ['a.ts'],
    constraints: 'offline',
    objective: 'ship it',
    done: ['draft'],
    next_steps: 'review',
  })
  assert.equal(report.contextCoverage, 1)
  assert.equal(report.driftCount, 5)
  assert.equal(report.overallStatus, 'partial')
  assert.equal(report.findings.find((f) => f.slot === 'file_names').foundAs, 'files')
})

test('missing slots reduce coverage and are reported', () => {
  const report = auditMemorySnapshot({
    goal: 'x',
  })
  assert.equal(report.overallStatus, 'partial')
  assert.equal(report.contextCoverage, 1 / 5)
  assert.equal(report.findings.filter((f) => f.status === 'missing').length, 4)
})

test('empty snapshot is incomplete', () => {
  const report = auditMemorySnapshot({})
  assert.equal(report.overallStatus, 'incomplete')
  assert.equal(report.contextCoverage, 0)
})

test('blank values are treated as missing', () => {
  const report = auditMemorySnapshot({
    file_names: [],
    task_constraints: '   ',
    goal: null,
    completed_steps: {},
    next_phase: 'ok',
  })
  assert.equal(report.contextCoverage, 1 / 5)
  assert.ok(report.summary.includes('20%'))
})

test('one-level nested records are flattened', () => {
  const report = auditMemorySnapshot({
    context: { goal: 'nested goal', files: ['x.md'] },
    next_phase: 'verify',
  })
  assert.ok(report.contextCoverage >= 2 / 5)
  const goal = report.findings.find((f) => f.slot === 'goal')
  assert.equal(goal.foundAs, 'context.goal')
})

test('required slot list is stable', () => {
  assert.deepEqual([...REQUIRED_SLOTS], [
    'file_names',
    'task_constraints',
    'goal',
    'completed_steps',
    'next_phase',
  ])
})
