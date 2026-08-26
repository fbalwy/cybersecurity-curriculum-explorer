import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getPlan } from '../data/plans'
import { buildFocusedFlowLayout } from './FocusedFlowView'
import { LevelView } from './LevelView'

describe('focused curriculum flow', () => {
  it('keeps every level, centers only related courses, and uses deterministic metro paths', () => {
    const plan = getPlan('developed')
    const first = buildFocusedFlowLayout(plan, 'CYB215', 'full')
    const second = buildFocusedFlowLayout(plan, 'CYB215', 'full')
    const codes = first.stages.flatMap((stage) => stage.cards.map((card) => card.course.code))

    expect(first.stages).toHaveLength(11)
    expect(codes).toEqual(['CS111', 'CS112', 'CS113', 'CYB215', 'CYB382', 'CYB423'])
    expect(first.stages[3].cards).toHaveLength(0)
    expect(first.edges).toHaveLength(5)
    expect(first.landings).toHaveLength(5)
    expect(first.edges.map((edge) => edge.path)).toEqual(second.edges.map((edge) => edge.path))
    expect(first.bundles.map((segment) => segment.path)).toEqual(second.bundles.map((segment) => segment.path))
    expect(first.bundles.length).toBeGreaterThan(0)

    expect(first.edges.every((edge) => edge.path.startsWith('M '))).toBe(true)
    expect(first.edges.every((edge) => edge.path.includes(' L '))).toBe(true)
    expect(first.bundles.some((segment) => segment.path.includes(' Q '))).toBe(true)
  })

  it('bundles fan-out relationships into one source spine with clear junctions', () => {
    const plan = getPlan('developed')
    const layout = buildFocusedFlowLayout(plan, 'CS112', 'full')
    const repeated = buildFocusedFlowLayout(plan, 'CS112', 'full')
    const sourceEdges = layout.edges.filter((edge) => edge.source === 'CS112')
    const sourceSpines = layout.bundles.filter(
      (segment) => segment.source === 'CS112' && segment.role === 'spine',
    )
    const sourceBuses = layout.bundles.filter(
      (segment) => segment.source === 'CS112' && segment.role === 'bus',
    )

    expect(sourceEdges).toHaveLength(3)
    expect(sourceSpines).toHaveLength(1)
    expect(sourceBuses.length).toBeGreaterThanOrEqual(1)
    expect(layout.junctions.filter((junction) => junction.id.includes(':CS112:'))).toHaveLength(3)
    expect(layout.edges.map((edge) => edge.path)).toEqual(repeated.edges.map((edge) => edge.path))
    expect(layout.bundles.map((segment) => segment.path)).toEqual(repeated.bundles.map((segment) => segment.path))
  })

  it('merges fan-in routes into one landing arrow per destination card', () => {
    const plan = getPlan('developed')
    const layout = buildFocusedFlowLayout(plan, 'CYB353', 'full')
    const incoming = layout.edges.filter((edge) => edge.target === 'CYB353')
    const landings = layout.landings.filter((landing) => landing.target === 'CYB353')
    const receivers = layout.bundles.filter((segment) => segment.role === 'receiver')

    expect(incoming.length).toBeGreaterThan(1)
    expect(landings).toHaveLength(1)
    expect(receivers.length).toBeGreaterThan(0)
  })

  it('keeps old-plan project routes in separate stable lanes', () => {
    const plan = getPlan('old')
    const layout = buildFocusedFlowLayout(plan, 'CYB251', 'full', true)
    const projectSpine = layout.bundles.find(
      (segment) => segment.source === 'CYB487' && segment.role === 'spine',
    )

    expect(projectSpine).toBeDefined()
    expect(projectSpine?.path).not.toContain('Q ')
    const projectSpineXs = [...(projectSpine?.path.matchAll(/[ML]\s+(-?\d+(?:\.\d+)?)\s/g) ?? [])]
      .map((match) => Number(match[1]))
    expect(new Set(projectSpineXs).size).toBe(1)
  })

  it('switches from the full plan to the selected flow without retaining unrelated cards', () => {
    const plan = getPlan('developed')
    const onSelectCourse = vi.fn()
    const view = render(
      <LevelView
        focusMode="full"
        hideEmptyLevels={false}
        onSelectCourse={onSelectCourse}
        plan={plan}
        selectedCode={null}
      />,
    )

    expect(view.container.querySelectorAll('[data-course-code]')).toHaveLength(plan.courses.length)
    expect(view.container.querySelector('.relationship-overlay')).toBeNull()

    view.rerender(
      <LevelView
        focusMode="full"
        hideEmptyLevels={false}
        onSelectCourse={onSelectCourse}
        plan={plan}
        selectedCode="CYB215"
      />,
    )

    const visibleCodes = [...view.container.querySelectorAll<HTMLElement>('[data-course-code]')]
      .map((card) => card.dataset.courseCode)
    expect(visibleCodes).toEqual(['CS111', 'CS112', 'CS113', 'CYB215', 'CYB382', 'CYB423'])
    expect(view.container.querySelectorAll('.focused-flow-stage')).toHaveLength(11)
    expect(view.container.querySelector('#focused-level-4')).toHaveAttribute('data-active-count', '0')
    expect(view.container.querySelector('.relationship-overlay')).toHaveAttribute('data-edge-count', '5')
    expect(view.container.querySelectorAll('[data-role="landing"]')).toHaveLength(5)
    expect(view.container.querySelectorAll('[data-role="arrival"][marker-end]')).toHaveLength(0)
    expect(view.container.querySelector('[data-coordinate-system="fixed-logical"]')).toBeInTheDocument()

    const haloLayer = view.container.querySelector('[data-paint-layer="halos"]')!
    const connectorLayer = view.container.querySelector('[data-paint-layer="connectors"]')!
    expect(haloLayer.nextElementSibling).toBe(connectorLayer)
    expect(haloLayer.querySelectorAll('.relationship-path')).toHaveLength(0)
    expect(connectorLayer.querySelectorAll('.relationship-path-halo')).toHaveLength(0)

    fireEvent.click(view.container.querySelector('[data-course-code="CYB382"]')!)
    expect(onSelectCourse).toHaveBeenCalledWith('CYB382')
  })

  it('limits direct mode to the selected course and immediate prerequisite', () => {
    const plan = getPlan('developed')
    const { container } = render(
      <LevelView
        focusMode="direct"
        hideEmptyLevels={false}
        onSelectCourse={() => undefined}
        plan={plan}
        selectedCode="CYB215"
      />,
    )

    const visibleCodes = [...container.querySelectorAll<HTMLElement>('[data-course-code]')]
      .map((card) => card.dataset.courseCode)
    expect(visibleCodes).toEqual(['CS113', 'CYB215'])
    expect(container.querySelector('.relationship-overlay')).toHaveAttribute('data-edge-count', '1')
  })

  it.each([
    ['direct', 2],
    ['full', 6],
    ['unlocks', 3],
  ] as const)('hides empty levels in %s mode while preserving the relationships', (mode, expectedStages) => {
    const plan = getPlan('developed')
    const expanded = buildFocusedFlowLayout(plan, 'CYB215', mode, false)
    const compact = buildFocusedFlowLayout(plan, 'CYB215', mode, true)

    expect(compact.stages).toHaveLength(expectedStages)
    expect(compact.stages.every((stage) => stage.cards.length > 0)).toBe(true)
    expect(compact.edges.map(({ source, target }) => `${source}:${target}`)).toEqual(
      expanded.edges.map(({ source, target }) => `${source}:${target}`),
    )
    expect(compact.height).toBeLessThan(expanded.height)
  })
})
