import { describe, expect, it } from 'vitest'
import { getPlan } from '../data/plans'
import { ancestors, directDependents, focusState } from './graph'

describe('curriculum relationships', () => {
  it('builds the developed Network Security path only from explicit Req cells', () => {
    const plan = getPlan('developed')
    const focus = focusState(plan, 'CYB375', 'full')

    expect([...ancestors(plan, 'CYB375')]).toEqual(['CYB253', 'CYB151'])
    expect(directDependents(plan, 'CYB375').map((course) => course.code)).toEqual(['CYB431'])
    expect(focus.activeCodes).toEqual(
      new Set(['CYB151', 'CYB253', 'CYB375', 'CYB431']),
    )
    expect(focus.edges.map(({ source, target }) => `${source}->${target}`)).toEqual([
      'CYB151->CYB253',
      'CYB253->CYB375',
      'CYB375->CYB431',
    ])
  })

  it('does not invent Operating Systems or Cybersecurity Fundamentals as Network Security prerequisites', () => {
    const active = focusState(getPlan('developed'), 'CYB375', 'full').activeCodes

    expect(active.has('CYB215')).toBe(false)
    expect(active.has('CYB182')).toBe(false)
  })

  it('isolates upstream and downstream focus modes', () => {
    const plan = getPlan('developed')

    expect(focusState(plan, 'CYB375', 'direct').activeCodes).toEqual(
      new Set(['CYB253', 'CYB375']),
    )
    expect(focusState(plan, 'CYB375', 'unlocks').activeCodes).toEqual(
      new Set(['CYB375', 'CYB431']),
    )
    expect(focusState(plan, 'CYB375', 'unlocks').edges).toHaveLength(1)
  })

  it('keeps direct mode limited to the selected course and its immediate prerequisites', () => {
    const focus = focusState(getPlan('developed'), 'CYB215', 'direct')

    expect(focus.activeCodes).toEqual(new Set(['CS113', 'CYB215']))
    expect(focus.upstreamCodes).toEqual(new Set(['CS113']))
    expect(focus.downstreamCodes).toEqual(new Set())
    expect(focus.edges).toEqual([
      { source: 'CS113', target: 'CYB215', relationship: 'upstream' },
    ])
    expect(focus.activeCodes.has('CS112')).toBe(false)
    expect(focus.activeCodes.has('CYB382')).toBe(false)
  })

  it('includes every upstream ancestor and every downstream descendant in full mode', () => {
    const focus = focusState(getPlan('developed'), 'CYB215', 'full')

    expect(focus.upstreamCodes).toEqual(new Set(['CS113', 'CS112', 'CS111']))
    expect(focus.downstreamCodes).toEqual(new Set(['CYB382', 'CYB423']))
    expect(focus.activeCodes).toEqual(
      new Set(['CS111', 'CS112', 'CS113', 'CYB215', 'CYB382', 'CYB423']),
    )
    expect(focus.edges).toEqual([
      { source: 'CS111', target: 'CS112', relationship: 'upstream' },
      { source: 'CS112', target: 'CS113', relationship: 'upstream' },
      { source: 'CS113', target: 'CYB215', relationship: 'upstream' },
      { source: 'CYB215', target: 'CYB382', relationship: 'downstream' },
      { source: 'CYB215', target: 'CYB423', relationship: 'downstream' },
    ])
  })

  it('includes transitive downstream branches in full and unlocks modes', () => {
    const plan = getPlan('developed')
    const expectedDescendants = new Set([
      'CS113',
      'CS114',
      'CYB215',
      'CYB382',
      'CYB423',
      'CS276',
      'CYB226',
      'CS285',
      'CYB353',
      'CYB439',
      'CYB416',
      'CYB351',
    ])
    const full = focusState(plan, 'CS112', 'full')
    const unlocks = focusState(plan, 'CS112', 'unlocks')

    expect(full.upstreamCodes).toEqual(new Set(['CS111']))
    expect(full.downstreamCodes).toEqual(expectedDescendants)
    expect(full.activeCodes).toEqual(new Set(['CS111', 'CS112', ...expectedDescendants]))

    expect(unlocks.upstreamCodes).toEqual(new Set())
    expect(unlocks.downstreamCodes).toEqual(expectedDescendants)
    expect(unlocks.activeCodes).toEqual(new Set(['CS112', ...expectedDescendants]))
    expect(unlocks.activeCodes.has('CS111')).toBe(false)
    expect(unlocks.edges.every((edge) => edge.relationship === 'downstream')).toBe(true)
  })

  it('returns an empty focus state for a course outside the plan', () => {
    expect(focusState(getPlan('developed'), 'NOT-A-COURSE', 'full')).toEqual({
      activeCodes: new Set(),
      upstreamCodes: new Set(),
      downstreamCodes: new Set(),
      edges: [],
    })
  })

  it('builds the old Network Security chain independently', () => {
    const plan = getPlan('old')

    expect([...ancestors(plan, 'CYB365')]).toEqual(['CYB251', 'CYB252'])
    expect(directDependents(plan, 'CYB365').map((course) => course.code)).toEqual(['CYB432'])
  })

  it('preserves unresolved prerequisite references in the developed plan', () => {
    const plan = getPlan('developed')

    expect(plan.unresolved).toEqual([
      expect.objectContaining({ course: 'CYB388', missing: 'CYB270' }),
      expect.objectContaining({ course: 'CYB444', missing: 'CS372' }),
      expect.objectContaining({ course: 'CYB434', missing: 'CS131' }),
    ])
  })

  it('keeps the source totals and complete course counts', () => {
    const oldPlan = getPlan('old')
    const developedPlan = getPlan('developed')

    expect(oldPlan.totalCredits).toBe(154)
    expect(oldPlan.courses.filter((course) => course.kind === 'required')).toHaveLength(53)
    expect(oldPlan.courses.filter((course) => course.kind === 'elective_option')).toHaveLength(15)
    expect(developedPlan.totalCredits).toBe(152)
    expect(developedPlan.courses.filter((course) => course.kind === 'required')).toHaveLength(50)
    expect(developedPlan.courses.filter((course) => course.kind === 'elective_option')).toHaveLength(15)
  })
})
