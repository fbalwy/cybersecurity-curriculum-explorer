import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import { AlertTriangle, ArrowDown, GitBranch } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Course, FocusMode, StudyPlan } from '../data/types'
import { focusState, unresolvedForCourse, type RelationshipEdge } from '../lib/graph'

export interface FocusedFlowViewProps {
  plan: StudyPlan
  selectedCode: string
  focusMode: FocusMode
  hideEmptyLevels: boolean
  onSelectCourse: (code: string) => void
}

type ActiveRelation = 'selected' | 'upstream' | 'downstream'

interface LogicalCard {
  course: Course
  height: number
  relation: ActiveRelation
  rowIndex: number
  width: number
  x: number
  y: number
}

interface LogicalStage {
  cards: LogicalCard[]
  height: number
  rowIndex: number
  top: number
}

interface LogicalEdge extends RelationshipEdge {
  id: string
  path: string
}

interface LogicalSegment {
  id: string
  path: string
  relationship: RelationshipEdge['relationship']
  role: 'spine' | 'bus' | 'receiver'
  source: string
}

interface LogicalLanding {
  id: string
  path: string
  relationship: RelationshipEdge['relationship']
  target: string
}

interface LogicalJunction {
  id: string
  relationship: RelationshipEdge['relationship']
  x: number
  y: number
}

export interface FocusedLayout {
  bundles: LogicalSegment[]
  edges: LogicalEdge[]
  height: number
  junctions: LogicalJunction[]
  landings: LogicalLanding[]
  stages: LogicalStage[]
}

interface RoutePoint {
  x: number
  y: number
}

const LEVEL_COUNT = 10
const ELECTIVE_ROW_INDEX = LEVEL_COUNT
const ROW_COUNT = LEVEL_COUNT + 1
export const FOCUSED_FLOW_WIDTH = 1160
const LABEL_WIDTH = 118
const BASE_STAGE_HEIGHT = 148
const STAGE_GAP = 36
const CARD_HEIGHT = 94
const CARD_WIDTH = 190
const CARD_GAP = 22
const CARD_ROW_GAP = 36
const CARDS_PER_LINE = 4
const COURSE_LEFT = LABEL_WIDTH + 34
const COURSE_RIGHT = FOCUSED_FLOW_WIDTH - 34
const COURSE_WIDTH = COURSE_RIGHT - COURSE_LEFT
const ROUTE_CLEARANCE = 12
const ROUTE_LANE_SEPARATION = 18
const ROUTE_LANE_CONFLICT_PENALTY = 4000
const MICRO_CHANNEL_SHIFT = 10
const TARGET_APPROACH = 27
const RECEIVER_DROP = 6
const TARGET_ARROW_GAP = 3
const BEND_RADIUS = 8

function relationFor(
  course: Course,
  selectedCode: string,
  upstreamCodes: Set<string>,
): ActiveRelation {
  if (course.code === selectedCode) return 'selected'
  return upstreamCodes.has(course.code) ? 'upstream' : 'downstream'
}

function rowForCourse(course: Course): number {
  if (course.level != null && course.level >= 1 && course.level <= LEVEL_COUNT) {
    return course.level - 1
  }
  return ELECTIVE_ROW_INDEX
}

function cardsForStage(
  courses: Course[],
  rowIndex: number,
  stageTop: number,
  selectedCode: string,
  upstreamCodes: Set<string>,
): LogicalCard[] {
  const sorted = [...courses].sort((a, b) => a.code.localeCompare(b.code))
  const cards: LogicalCard[] = []

  for (let offset = 0; offset < sorted.length; offset += CARDS_PER_LINE) {
    const line = sorted.slice(offset, offset + CARDS_PER_LINE)
    const occupiedWidth = line.length * CARD_WIDTH + Math.max(0, line.length - 1) * CARD_GAP
    const startX = COURSE_LEFT + (COURSE_WIDTH - occupiedWidth) / 2
    const lineIndex = Math.floor(offset / CARDS_PER_LINE)
    const y = stageTop + 24 + lineIndex * (CARD_HEIGHT + CARD_ROW_GAP)

    line.forEach((course, itemIndex) => {
      cards.push({
        course,
        height: CARD_HEIGHT,
        relation: relationFor(course, selectedCode, upstreamCodes),
        rowIndex,
        width: CARD_WIDTH,
        x: startX + itemIndex * (CARD_WIDTH + CARD_GAP),
        y,
      })
    })
  }

  return cards
}

function alignSingletonStages(stages: LogicalStage[], relationships: RelationshipEdge[]): void {
  const positions = new Map(stages.flatMap((stage) => stage.cards).map((card) => [card.course.code, card]))

  stages.forEach((stage) => {
    if (stage.cards.length !== 1) return
    const target = stage.cards[0]
    const incomingSources = relationships
      .filter((edge) => edge.target === target.course.code)
      .map((edge) => positions.get(edge.source))
      .filter((source): source is LogicalCard => Boolean(source && source.y < target.y))
    if (incomingSources.length !== 1) return

    const source = incomingSources[0]
    const alignedX = source.x + (source.width - target.width) / 2
    target.x = roundCoordinate(Math.max(COURSE_LEFT, Math.min(COURSE_RIGHT - target.width, alignedX)))
  })
}

function roundCoordinate(value: number): number {
  return Math.round(value * 10) / 10
}

function samePoint(a: RoutePoint, b: RoutePoint): boolean {
  return Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1
}

function addRoutePoint(points: RoutePoint[], point: RoutePoint): void {
  const rounded = { x: roundCoordinate(point.x), y: roundCoordinate(point.y) }
  const last = points.at(-1)
  if (last && samePoint(last, rounded)) return

  const previous = points.at(-2)
  if (
    previous &&
    last &&
    ((Math.abs(previous.x - last.x) < 0.1 && Math.abs(last.x - rounded.x) < 0.1) ||
      (Math.abs(previous.y - last.y) < 0.1 && Math.abs(last.y - rounded.y) < 0.1))
  ) {
    points[points.length - 1] = rounded
    return
  }
  points.push(rounded)
}

function distance(a: RoutePoint, b: RoutePoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function moveToward(from: RoutePoint, to: RoutePoint, amount: number): RoutePoint {
  if (Math.abs(from.x - to.x) < 0.1) {
    return { x: from.x, y: from.y + Math.sign(to.y - from.y) * amount }
  }
  return { x: from.x + Math.sign(to.x - from.x) * amount, y: from.y }
}

function roundedOrthogonalPath(points: RoutePoint[]): string {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const commands = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    const radius = Math.min(BEND_RADIUS, distance(previous, corner) / 2, distance(corner, next) / 2)
    if (radius < 0.5) {
      commands.push(`L ${corner.x} ${corner.y}`)
      continue
    }
    const entry = moveToward(corner, previous, radius)
    const exit = moveToward(corner, next, radius)
    commands.push(`L ${roundCoordinate(entry.x)} ${roundCoordinate(entry.y)}`)
    commands.push(`Q ${corner.x} ${corner.y} ${roundCoordinate(exit.x)} ${roundCoordinate(exit.y)}`)
  }
  const last = points.at(-1)!
  commands.push(`L ${last.x} ${last.y}`)
  return commands.join(' ')
}

interface BlockedInterval {
  left: number
  right: number
}

function blockedIntervals(stage: LogicalStage): BlockedInterval[] {
  const intervals = stage.cards
    .map((card) => ({
      left: Math.max(COURSE_LEFT, card.x - ROUTE_CLEARANCE),
      right: Math.min(COURSE_RIGHT, card.x + card.width + ROUTE_CLEARANCE),
    }))
    .sort((a, b) => a.left - b.left)

  const merged: BlockedInterval[] = []
  intervals.forEach((interval) => {
    const previous = merged.at(-1)
    if (!previous || interval.left > previous.right) {
      merged.push({ ...interval })
    } else {
      previous.right = Math.max(previous.right, interval.right)
    }
  })
  return merged
}

function freeChannels(stage: LogicalStage, preferred: number[], allowCardCenters: boolean): number[] {
  const minimum = COURSE_LEFT + ROUTE_CLEARANCE
  const maximum = COURSE_RIGHT - ROUTE_CLEARANCE
  const blocked = blockedIntervals(stage)
  const candidates = new Set<number>()
  const add = (value: number) => {
    const clamped = roundCoordinate(Math.max(minimum, Math.min(maximum, value)))
    if (allowCardCenters || blocked.every((interval) => clamped <= interval.left || clamped >= interval.right)) {
      candidates.add(clamped)
    }
  }

  preferred.forEach(add)
  add(FOCUSED_FLOW_WIDTH / 2)
  add(minimum)
  add(maximum)

  let cursor = minimum
  blocked.forEach((interval) => {
    if (interval.left > cursor) {
      add(cursor)
      add((cursor + interval.left) / 2)
      add(interval.left)
    }
    cursor = Math.max(cursor, interval.right)
  })
  if (cursor < maximum) {
    add(cursor)
    add((cursor + maximum) / 2)
    add(maximum)
  }

  return [...candidates].sort((a, b) => a - b)
}

function targetBusY(stage: LogicalStage, targetY: number): number {
  const cardLines = [...new Set(stage.cards.map((card) => card.y))].sort((a, b) => a - b)
  const lineIndex = cardLines.indexOf(targetY)
  const previousLineY = lineIndex > 0 ? cardLines[lineIndex - 1] : null
  const idealY = targetY - TARGET_APPROACH

  if (previousLineY == null) return idealY

  const minimumClearanceY = previousLineY + CARD_HEIGHT + 8
  return Math.max(idealY, minimumClearanceY)
}

function chooseBundleChannels(
  stages: LogicalStage[],
  source: LogicalCard,
  targets: LogicalCard[],
  targetPorts: Map<string, number>,
  reservedByStage: Map<number, number[]>,
): Map<number, number> {
  const lastRow = Math.max(...targets.map((target) => target.rowIndex))
  const routeStages = stages.filter(
    (stage) => stage.rowIndex > source.rowIndex && stage.rowIndex <= lastRow,
  )
  const rows = routeStages.map((stage) => stage.rowIndex)
  const desired = targets.reduce((sum, target) => sum + (targetPorts.get(target.course.code) ?? target.x + target.width / 2), 0) / targets.length
  const candidatesByRow = routeStages.map((stage) => {
    const rowIndex = stage.rowIndex
    const rowTargets = targets.filter((target) => target.rowIndex === rowIndex)
    const rowTargetPorts = rowTargets.map((target) => targetPorts.get(target.course.code) ?? target.x + target.width / 2)
    const targetLineCount = new Set(rowTargets.map((target) => target.y)).size
    const canStopAboveCards = rowIndex === lastRow && targetLineCount === 1
    return freeChannels(stage, [desired, ...rowTargetPorts], canStopAboveCards)
  })

  type State = { cost: number; previous: number | null }
  const states: Array<Map<number, State>> = []
  const sourceX = source.x + source.width / 2

  candidatesByRow.forEach((candidates, rowOffset) => {
    const rowIndex = rows[rowOffset]
    const reserved = reservedByStage.get(rowIndex) ?? []
    const currentStates = new Map<number, State>()
    candidates.forEach((candidate) => {
      const reservationPenalty = reserved.reduce(
        (penalty, used) => penalty + (Math.abs(used - candidate) < ROUTE_LANE_SEPARATION ? ROUTE_LANE_CONFLICT_PENALTY : 0),
        0,
      )
      const targetPenalty = Math.abs(candidate - desired) * 0.08
      if (rowOffset === 0) {
        currentStates.set(candidate, {
          cost: Math.abs(sourceX - candidate) + targetPenalty + reservationPenalty,
          previous: null,
        })
        return
      }

      let best: State | null = null
      states[rowOffset - 1].forEach((previousState, previousCandidate) => {
        const changedLane = Math.abs(previousCandidate - candidate) >= 0.1
        const cost = previousState.cost + Math.abs(previousCandidate - candidate) + (changedLane ? 14 : 0) + targetPenalty + reservationPenalty
        if (!best || cost < best.cost || (Math.abs(cost - best.cost) < 0.1 && previousCandidate < (best.previous ?? Number.POSITIVE_INFINITY))) {
          best = { cost, previous: previousCandidate }
        }
      })
      if (best) currentStates.set(candidate, best)
    })
    states.push(currentStates)
  })

  const result = new Map<number, number>()
  const finalStates = states.at(-1)
  if (!finalStates) return result
  const finalCandidate = [...finalStates.entries()].sort((a, b) => a[1].cost - b[1].cost || a[0] - b[0])[0]?.[0]
  if (finalCandidate == null) return result

  let current: number | null = finalCandidate
  for (let rowOffset = rows.length - 1; rowOffset >= 0 && current != null; rowOffset -= 1) {
    result.set(rows[rowOffset], current)
    const state: State | undefined = states[rowOffset].get(current)
    current = state?.previous ?? null
  }
  return result
}

function fallbackEdgePath(source: LogicalCard, target: LogicalCard): string {
  const sourceX = source.x + source.width / 2
  const targetX = target.x + target.width / 2
  const sourceY = source.y + source.height
  const targetY = target.y
  const laneY = Math.max(sourceY, target.y + target.height) + 16
  const points: RoutePoint[] = []
  addRoutePoint(points, { x: sourceX, y: sourceY })
  addRoutePoint(points, { x: sourceX, y: laneY })
  addRoutePoint(points, { x: targetX, y: laneY })
  addRoutePoint(points, { x: targetX, y: target.y + target.height + TARGET_ARROW_GAP })
  return roundedOrthogonalPath(points)
}

export function buildFocusedFlowLayout(
  plan: StudyPlan,
  selectedCode: string,
  focusMode: FocusMode,
  hideEmptyLevels = false,
): FocusedLayout {
  const focus = focusState(plan, selectedCode, focusMode)
  const grouped = Array.from({ length: ROW_COUNT }, () => [] as Course[])
  plan.courses.forEach((course) => {
    if (focus.activeCodes.has(course.code)) grouped[rowForCourse(course)].push(course)
  })

  const visibleGroups = grouped
    .map((courses, rowIndex) => ({ courses, rowIndex }))
    .filter(({ courses }) => !hideEmptyLevels || courses.length > 0)

  let cursor = 0
  const stages = visibleGroups.map(({ courses, rowIndex }, visibleIndex) => {
    const lineCount = Math.max(1, Math.ceil(courses.length / CARDS_PER_LINE))
    const contentHeight = 48 + lineCount * CARD_HEIGHT + Math.max(0, lineCount - 1) * CARD_ROW_GAP
    const height = Math.max(BASE_STAGE_HEIGHT, contentHeight)
    const stage: LogicalStage = {
      cards: cardsForStage(courses, rowIndex, cursor, selectedCode, focus.upstreamCodes),
      height,
      rowIndex,
      top: cursor,
    }
    cursor += height + (visibleIndex === visibleGroups.length - 1 ? 0 : STAGE_GAP)
    return stage
  })

  alignSingletonStages(stages, focus.edges)

  const allCards = stages.flatMap((stage) => stage.cards)
  const positions = new Map(allCards.map((card) => [card.course.code, card]))
  const sourceEdges = [...focus.edges]
    .filter((edge) => positions.has(edge.source) && positions.has(edge.target))
    .sort((a, b) =>
      a.relationship.localeCompare(b.relationship) ||
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target),
    )

  const incomingByTarget = new Map<string, RelationshipEdge[]>()
  sourceEdges.forEach((edge) => {
    const incoming = incomingByTarget.get(edge.target) ?? []
    incoming.push(edge)
    incomingByTarget.set(edge.target, incoming)
  })

  const inboundPorts = new Map<string, number>()
  incomingByTarget.forEach((incoming, targetCode) => {
    const target = positions.get(targetCode)
    if (!target) return
    incoming
      .sort((a, b) => {
        const aSource = positions.get(a.source)
        const bSource = positions.get(b.source)
        const aX = aSource ? aSource.x + aSource.width / 2 : 0
        const bX = bSource ? bSource.x + bSource.width / 2 : 0
        return aX - bX || a.source.localeCompare(b.source)
      })
      .forEach((edge, index) => {
        const port = target.x + (target.width * (index + 1)) / (incoming.length + 1)
        inboundPorts.set(`${edge.relationship}:${edge.source}:${edge.target}`, roundCoordinate(port))
      })
  })

  const groupedBySource = new Map<string, RelationshipEdge[]>()
  sourceEdges.forEach((edge) => {
    const key = `${edge.relationship}:${edge.source}`
    const group = groupedBySource.get(key) ?? []
    group.push(edge)
    groupedBySource.set(key, group)
  })

  const bundles: LogicalSegment[] = []
  const edges: LogicalEdge[] = []
  const junctions: LogicalJunction[] = []
  const landings: LogicalLanding[] = []
  const reservedByStage = new Map<number, number[]>()

  ;[...groupedBySource.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([groupKey, groupEdges]) => {
      const source = positions.get(groupEdges[0].source)
      if (!source) return
      const downwardEdges = groupEdges.filter((edge) => {
        const target = positions.get(edge.target)
        return target && target.y > source.y + source.height
      })
      const fallbackEdges = groupEdges.filter((edge) => !downwardEdges.includes(edge))

      fallbackEdges.forEach((edge) => {
        const target = positions.get(edge.target)
        if (!target) return
        edges.push({
          ...edge,
          id: `${edge.relationship}:${edge.source}:${edge.target}`,
          path: fallbackEdgePath(source, target),
        })
      })

      if (!downwardEdges.length) return
      const targets = downwardEdges
        .map((edge) => positions.get(edge.target))
        .filter((target): target is LogicalCard => Boolean(target))
      const targetPorts = new Map<string, number>()
      downwardEdges.forEach((edge) => {
        const key = `${edge.relationship}:${edge.source}:${edge.target}`
        const target = positions.get(edge.target)
        if (target) targetPorts.set(edge.target, inboundPorts.get(key) ?? target.x + target.width / 2)
      })

      const lastRow = Math.max(...targets.map((target) => target.rowIndex))
      const routeStages = stages.filter(
        (stage) => stage.rowIndex > source.rowIndex && stage.rowIndex <= lastRow,
      )
      const sourceX = source.x + source.width / 2
      const channels = chooseBundleChannels(stages, source, targets, targetPorts, reservedByStage)
      let previousChannel = sourceX
      routeStages.forEach((stage) => {
        const proposedChannel = channels.get(stage.rowIndex)
        if (proposedChannel == null) return
        const stableChannel = Math.abs(proposedChannel - previousChannel) < MICRO_CHANNEL_SHIFT
          ? previousChannel
          : proposedChannel
        channels.set(stage.rowIndex, stableChannel)
        previousChannel = stableChannel
      })
      channels.forEach((channel, rowIndex) => {
        const reserved = reservedByStage.get(rowIndex) ?? []
        reserved.push(channel)
        reservedByStage.set(rowIndex, reserved)
      })

      const sourceY = source.y + source.height
      const firstRouteRow = routeStages[0]?.rowIndex
      let currentX = firstRouteRow == null ? sourceX : (channels.get(firstRouteRow) ?? sourceX)
      let currentY = sourceY
      const spinePoints: RoutePoint[] = []
      addRoutePoint(spinePoints, { x: sourceX, y: sourceY })
      addRoutePoint(spinePoints, { x: sourceX, y: sourceY + 13 })
      addRoutePoint(spinePoints, { x: currentX, y: sourceY + 13 })
      currentY = sourceY + 13

      for (const [routeIndex, stage] of routeStages.entries()) {
        const rowIndex = stage.rowIndex
        const nextChannel = channels.get(rowIndex) ?? currentX
        const transitionY = stage.top - STAGE_GAP / 2
        if (currentY < transitionY) {
          addRoutePoint(spinePoints, { x: currentX, y: transitionY })
          currentY = transitionY
        }
        if (Math.abs(currentX - nextChannel) >= 0.1) {
          addRoutePoint(spinePoints, { x: nextChannel, y: currentY })
          currentX = nextChannel
        }

        const stageEdges = downwardEdges.filter((edge) => positions.get(edge.target)?.rowIndex === rowIndex)
        const edgesByLine = new Map<number, RelationshipEdge[]>()
        stageEdges.forEach((edge) => {
          const target = positions.get(edge.target)
          if (!target) return
          const line = edgesByLine.get(target.y) ?? []
          line.push(edge)
          edgesByLine.set(target.y, line)
        })

        ;[...edgesByLine.entries()]
          .sort(([a], [b]) => a - b)
          .forEach(([targetY, lineEdges]) => {
            const busY = targetBusY(stage, targetY)
            const receiverY = busY + RECEIVER_DROP

            if (currentY < busY) {
              addRoutePoint(spinePoints, { x: currentX, y: busY })
              currentY = busY
            }

            const ports = lineEdges.map((edge) => {
              const target = positions.get(edge.target)!
              const edgeId = `${edge.relationship}:${edge.source}:${edge.target}`
              return {
                edge,
                edgeId,
                port: inboundPorts.get(edgeId) ?? target.x + target.width / 2,
                target,
              }
            })
            const busLeft = Math.min(currentX, ...ports.map((item) => item.port))
            const busRight = Math.max(currentX, ...ports.map((item) => item.port))
            if (busRight - busLeft >= 0.1) {
              const busPoints: RoutePoint[] = []
              addRoutePoint(busPoints, { x: busLeft, y: busY })
              addRoutePoint(busPoints, { x: busRight, y: busY })
              bundles.push({
                id: `${groupKey}:bus:${roundCoordinate(busY)}`,
                path: roundedOrthogonalPath(busPoints),
                relationship: lineEdges[0].relationship,
                role: 'bus',
                source: lineEdges[0].source,
              })
            }

            ports.forEach(({ edge, edgeId, port, target }) => {
              const dropPoints: RoutePoint[] = []
              addRoutePoint(dropPoints, { x: port, y: busY })
              addRoutePoint(dropPoints, { x: port, y: receiverY })
              edges.push({ ...edge, id: edgeId, path: roundedOrthogonalPath(dropPoints) })
            })

            if (downwardEdges.length > 1) {
              junctions.push({
                id: `${groupKey}:junction:${roundCoordinate(busY)}`,
                relationship: lineEdges[0].relationship,
                x: currentX,
                y: busY,
              })
            }
          })

        if (routeIndex < routeStages.length - 1) {
          const exitY = stage.top + stage.height + STAGE_GAP / 2
          if (currentY < exitY) {
            addRoutePoint(spinePoints, { x: currentX, y: exitY })
            currentY = exitY
          }
        }
      }

      bundles.push({
        id: `${groupKey}:spine`,
        path: roundedOrthogonalPath(spinePoints),
        relationship: downwardEdges[0].relationship,
        role: 'spine',
        source: downwardEdges[0].source,
      })
    })

  const stageByRow = new Map(stages.map((stage) => [stage.rowIndex, stage]))
  incomingByTarget.forEach((incoming, targetCode) => {
    const target = positions.get(targetCode)
    const stage = target ? stageByRow.get(target.rowIndex) : undefined
    if (!target || !stage || !incoming.length) return

    const busY = targetBusY(stage, target.y)
    const receiverY = busY + RECEIVER_DROP
    const centerX = target.x + target.width / 2
    const ports = incoming.map((edge) => {
      const edgeId = `${edge.relationship}:${edge.source}:${edge.target}`
      return inboundPorts.get(edgeId) ?? centerX
    })
    const relationship = incoming[0].relationship
    const receiverLeft = Math.min(centerX, ...ports)
    const receiverRight = Math.max(centerX, ...ports)

    if (receiverRight - receiverLeft >= 0.1) {
      const receiverPoints: RoutePoint[] = []
      addRoutePoint(receiverPoints, { x: receiverLeft, y: receiverY })
      addRoutePoint(receiverPoints, { x: receiverRight, y: receiverY })
      bundles.push({
        id: `${relationship}:receiver:${targetCode}`,
        path: roundedOrthogonalPath(receiverPoints),
        relationship,
        role: 'receiver',
        source: incoming[0].source,
      })
    }

    if (incoming.length > 1) {
      ports.forEach((port, index) => {
        junctions.push({
          id: `merge-${targetCode}-${incoming[index].source}`,
          relationship,
          x: port,
          y: receiverY,
        })
      })
    }

    const landingPoints: RoutePoint[] = []
    addRoutePoint(landingPoints, { x: centerX, y: receiverY })
    addRoutePoint(landingPoints, { x: centerX, y: target.y - TARGET_ARROW_GAP })
    landings.push({
      id: `${relationship}:landing:${targetCode}`,
      path: roundedOrthogonalPath(landingPoints),
      relationship,
      target: targetCode,
    })
  })

  edges.sort((a, b) => a.id.localeCompare(b.id))
  bundles.sort((a, b) => a.id.localeCompare(b.id))
  junctions.sort((a, b) => a.id.localeCompare(b.id))
  landings.sort((a, b) => a.id.localeCompare(b.id))

  return { bundles, edges, height: cursor, junctions, landings, stages }
}

function FocusedCourseCard({
  card,
  onSelect,
  stageTop,
  unresolved,
}: {
  card: LogicalCard
  onSelect: (code: string) => void
  stageTop: number
  unresolved: boolean
}) {
  const { course, relation } = card
  const style: CSSProperties = {
    height: card.height,
    left: card.x - LABEL_WIDTH,
    minHeight: card.height,
    position: 'absolute',
    top: card.y - stageTop,
    width: card.width,
  }

  return (
    <button
      aria-pressed={relation === 'selected'}
      className={`level-course-card focused-course-card category-${course.categoryGroup} level-relation-${relation}`}
      data-course-code={course.code}
      data-relation={relation}
      onClick={() => onSelect(course.code)}
      style={style}
      type="button"
    >
      <span className="level-card-topline">
        <span className="level-card-code">{course.code}</span>
        {course.creditThreshold ? (
          <span className="level-card-condition" title={`${course.creditThreshold} earned credits required`}>
            {course.creditThreshold} CR
          </span>
        ) : null}
        {unresolved ? (
          <AlertTriangle aria-label="Unresolved prerequisite" className="level-card-warning" size={14} />
        ) : null}
      </span>
      <strong>{course.name}</strong>
      <small>{course.creditHours == null ? 'Credits not stated' : `${course.creditHours} credits`}</small>
    </button>
  )
}

function modeLabel(focusMode: FocusMode): string {
  if (focusMode === 'direct') return 'direct prerequisite'
  if (focusMode === 'unlocks') return 'courses it unlocks'
  return 'full path'
}

export function FocusedFlowView({
  plan,
  selectedCode,
  focusMode,
  hideEmptyLevels,
  onSelectCourse,
}: FocusedFlowViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const markerPrefix = useId().replaceAll(':', '')
  const selectedCourse = plan.courses.find((course) => course.code === selectedCode)
  const layout = useMemo(
    () => buildFocusedFlowLayout(plan, selectedCode, focusMode, hideEmptyLevels),
    [focusMode, hideEmptyLevels, plan, selectedCode],
  )
  const focus = useMemo(
    () => focusState(plan, selectedCode, focusMode),
    [focusMode, plan, selectedCode],
  )

  useLayoutEffect(() => {
    const scroller = scrollRef.current
    const selectedCard = layout.stages
      .flatMap((stage) => stage.cards)
      .find((card) => card.course.code === selectedCode)
    if (!scroller || !selectedCard) return

    const selectedCenter = selectedCard.x + selectedCard.width / 2
    const visibleLeft = scroller.scrollLeft + LABEL_WIDTH
    const visibleRight = scroller.scrollLeft + scroller.clientWidth - 24
    if (selectedCenter >= visibleLeft && selectedCenter <= visibleRight) return

    const availableCourseWidth = Math.max(1, scroller.clientWidth - LABEL_WIDTH)
    scroller.scrollLeft = Math.max(
      0,
      selectedCenter - LABEL_WIDTH - availableCourseWidth / 2,
    )
  }, [focusMode, layout, selectedCode])

  if (!selectedCourse) return null

  const upstreamMarkerId = `${markerPrefix}-focused-arrow-upstream`
  const downstreamMarkerId = `${markerPrefix}-focused-arrow-downstream`
  const electiveCount = plan.courses.filter((course) => course.kind === 'elective_option').length

  return (
    <section
      aria-label={`Focused ${modeLabel(focusMode)} for ${selectedCourse.code}`}
      className="level-view level-view--focused curriculum-view-enter"
      data-level-layout={hideEmptyLevels ? 'compact' : 'all'}
      id="curriculum-focus-view"
    >
      <div className="level-view__intro">
        <div>
          <span className="level-view__eyebrow">{plan.id}</span>
          <h2>{plan.label}</h2>
          <p>{focus.activeCodes.size} courses shown in the {modeLabel(focusMode)} view for {selectedCourse.code}. Click empty space to return to the full plan.</p>
        </div>
        <div className="level-view__summary">
          <GitBranch size={16} aria-hidden="true" />
          <strong>{focus.activeCodes.size}</strong>
          <span>courses in view</span>
        </div>
      </div>

      <div className="focused-flow-scroll" ref={scrollRef}>
        <div
          className="curriculum-content focused-flow-canvas"
          data-coordinate-system="fixed-logical"
          data-flow-height={layout.height}
          data-flow-width={FOCUSED_FLOW_WIDTH}
          style={{ height: layout.height, minWidth: FOCUSED_FLOW_WIDTH, width: FOCUSED_FLOW_WIDTH }}
        >
          {layout.edges.length ? (
            <svg
              aria-hidden="true"
              className="relationship-overlay focused-flow-edges"
              data-bundle-count={layout.bundles.length}
              data-edge-count={layout.edges.length}
              data-landing-count={layout.landings.length}
              height={layout.height}
              preserveAspectRatio="xMinYMin meet"
              viewBox={`0 0 ${FOCUSED_FLOW_WIDTH} ${layout.height}`}
              width={FOCUSED_FLOW_WIDTH}
            >
              <defs>
                <marker id={upstreamMarkerId} markerHeight="9" markerUnits="userSpaceOnUse" markerWidth="9" orient="auto" refX="8" refY="4.5">
                  <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#7c43e8" stroke="#7c43e8" strokeLinejoin="round" strokeWidth="0.7" />
                </marker>
                <marker id={downstreamMarkerId} markerHeight="9" markerUnits="userSpaceOnUse" markerWidth="9" orient="auto" refX="8" refY="4.5">
                  <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#079e9f" stroke="#079e9f" strokeLinejoin="round" strokeWidth="0.7" />
                </marker>
              </defs>
              <g data-paint-layer="halos">
                {layout.bundles.map((segment) => (
                  <path className="relationship-path-halo" d={segment.path} key={segment.id} />
                ))}
                {layout.edges.map((edge) => (
                  <path className="relationship-path-halo" d={edge.path} key={edge.id} />
                ))}
                {layout.landings.map((landing) => (
                  <path
                    className="relationship-path-halo relationship-path-halo--landing"
                    d={landing.path}
                    key={landing.id}
                  />
                ))}
              </g>
              <g data-paint-layer="connectors">
                {layout.bundles.map((segment) => (
                  <path
                    className={`relationship-path relationship-path--${segment.relationship} relationship-path--bundle relationship-path--${segment.role}`}
                    d={segment.path}
                    data-role={segment.role}
                    data-source={segment.source}
                    key={segment.id}
                    pathLength="1"
                  />
                ))}
                {layout.edges.map((edge) => (
                  <path
                    className={`relationship-path relationship-path--${edge.relationship} relationship-path--arrival`}
                    d={edge.path}
                    data-role="arrival"
                    data-source={edge.source}
                    data-target={edge.target}
                    key={edge.id}
                    pathLength="1"
                  />
                ))}
                {layout.landings.map((landing) => (
                  <path
                    className={`relationship-path relationship-path--${landing.relationship} relationship-path--landing`}
                    d={landing.path}
                    data-role="landing"
                    data-target={landing.target}
                    key={landing.id}
                    markerEnd={`url(#${landing.relationship === 'upstream' ? upstreamMarkerId : downstreamMarkerId})`}
                    pathLength="1"
                  />
                ))}
              </g>
              {layout.junctions.map((junction) => (
                <circle
                  className={`relationship-junction relationship-junction--${junction.relationship}`}
                  cx={junction.x}
                  cy={junction.y}
                  key={junction.id}
                  r="4"
                />
              ))}
            </svg>
          ) : null}

          {layout.stages.map((stage, stageIndex) => {
            const isElectiveRow = stage.rowIndex === ELECTIVE_ROW_INDEX
            const level = stage.rowIndex + 1
            const headingId = isElectiveRow ? 'focused-elective-catalog-heading' : `focused-level-${level}-heading`
            const heading = isElectiveRow ? 'Specialization elective catalog' : `Level ${level}`
            const summary = isElectiveRow
              ? `${electiveCount} source-listed options`
              : `${plan.levelTotals[String(level)]} credits`

            return (
              <section
                aria-labelledby={headingId}
                className={`level-band focused-flow-stage ${isElectiveRow ? 'focused-flow-stage--elective' : ''}`}
                data-active-count={stage.cards.length}
                id={isElectiveRow ? 'focused-elective-catalog' : `focused-level-${level}`}
                key={isElectiveRow ? 'electives' : level}
                style={{
                  gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr)`,
                  height: stage.height,
                  marginBottom: stageIndex === layout.stages.length - 1 ? 0 : STAGE_GAP,
                  minHeight: stage.height,
                  width: FOCUSED_FLOW_WIDTH,
                }}
              >
                <div className="level-band__label">
                  {isElectiveRow ? <span className="focused-elective-label">E</span> : null}
                  <div>
                    <strong id={headingId}>{heading}</strong>
                    <small>{summary}</small>
                  </div>
                  <ArrowDown aria-hidden="true" size={15} />
                </div>
                <div
                  aria-label={stage.cards.length ? `${heading}: ${stage.cards.length} courses in the active path` : `${heading}: no courses in the active path`}
                  className="level-band__courses focused-flow-stage__courses"
                >
                  {stage.cards.map((card) => (
                    <FocusedCourseCard
                      card={card}
                      key={card.course.code}
                      onSelect={onSelectCourse}
                      stageTop={stage.top}
                      unresolved={unresolvedForCourse(plan, card.course.code).length > 0}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>

    </section>
  )
}
