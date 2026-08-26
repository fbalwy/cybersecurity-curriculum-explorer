import type { Course, FocusMode, StudyPlan } from '../data/types'

export interface RelationshipEdge {
  source: string
  target: string
  relationship: 'upstream' | 'downstream'
}

export interface FocusState {
  activeCodes: Set<string>
  upstreamCodes: Set<string>
  downstreamCodes: Set<string>
  edges: RelationshipEdge[]
}

export function courseIndex(plan: StudyPlan): Map<string, Course> {
  return new Map(plan.courses.map((course) => [course.code, course]))
}

export function directDependents(plan: StudyPlan, code: string): Course[] {
  return plan.courses.filter((course) => course.prerequisites.includes(code))
}

export function ancestors(plan: StudyPlan, code: string): Set<string> {
  const index = courseIndex(plan)
  const result = new Set<string>()

  const visit = (currentCode: string) => {
    const course = index.get(currentCode)
    if (!course) return
    course.prerequisites.forEach((prerequisite) => {
      if (!index.has(prerequisite) || result.has(prerequisite)) return
      result.add(prerequisite)
      visit(prerequisite)
    })
  }

  visit(code)
  return result
}

export function descendants(plan: StudyPlan, code: string): Set<string> {
  const result = new Set<string>()
  const reverse = new Map<string, string[]>()

  plan.courses.forEach((course) => {
    course.prerequisites.forEach((prerequisite) => {
      const dependents = reverse.get(prerequisite) ?? []
      dependents.push(course.code)
      reverse.set(prerequisite, dependents)
    })
  })

  const visit = (currentCode: string) => {
    ;(reverse.get(currentCode) ?? []).forEach((dependent) => {
      if (result.has(dependent)) return
      result.add(dependent)
      visit(dependent)
    })
  }

  visit(code)
  return result
}

function edgesWithin(plan: StudyPlan, allowed: Set<string>, selectedCode: string): RelationshipEdge[] {
  const selectedDescendants = descendants(plan, selectedCode)
  const edges: RelationshipEdge[] = []

  plan.courses.forEach((course) => {
    if (!allowed.has(course.code)) return
    course.prerequisites.forEach((prerequisite) => {
      if (!allowed.has(prerequisite)) return
      edges.push({
        source: prerequisite,
        target: course.code,
        relationship:
          selectedDescendants.has(course.code) || prerequisite === selectedCode ? 'downstream' : 'upstream',
      })
    })
  })

  return edges
}

export function focusState(plan: StudyPlan, code: string, mode: FocusMode): FocusState {
  const index = courseIndex(plan)
  if (!index.has(code)) {
    return {
      activeCodes: new Set(),
      upstreamCodes: new Set(),
      downstreamCodes: new Set(),
      edges: [],
    }
  }

  const selected = index.get(code)!
  const allAncestors = ancestors(plan, code)
  const allDescendants = descendants(plan, code)
  const directPrerequisites = new Set(selected.prerequisites.filter((item) => index.has(item)))
  const directDownstreamCodes = new Set(directDependents(plan, code).map((course) => course.code))

  const upstreamCodes =
    mode === 'direct' ? directPrerequisites : mode === 'full' ? allAncestors : new Set<string>()
  const downstreamCodes =
    mode === 'direct-unlocks'
      ? directDownstreamCodes
      : mode === 'full' || mode === 'unlocks'
        ? allDescendants
        : new Set<string>()
  const activeCodes = new Set([code, ...upstreamCodes, ...downstreamCodes])
  const edges = mode === 'direct-unlocks'
    ? [...directDownstreamCodes].map((target) => ({
        source: code,
        target,
        relationship: 'downstream' as const,
      }))
    : edgesWithin(plan, activeCodes, code)

  return {
    activeCodes,
    upstreamCodes,
    downstreamCodes,
    edges,
  }
}

export function sortedCourses(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => {
    const aLevel = a.level ?? 99
    const bLevel = b.level ?? 99
    return aLevel - bLevel || a.code.localeCompare(b.code)
  })
}

export function unresolvedForCourse(plan: StudyPlan, code: string) {
  return plan.unresolved.filter((item) => item.course === code)
}

export function sourceRequirementLabel(course: Course): string {
  switch (course.requirementStatus) {
    case 'explicit_none':
      return 'The source explicitly states no prerequisite.'
    case 'not_specified':
      return 'The prerequisite cell is blank in the source.'
    case 'credit_threshold':
      return `${course.creditThreshold} earned credits required.`
    case 'all_of_courses_and_credits':
      return 'All listed courses and the credit threshold are required.'
    case 'all_of_courses':
      return 'All listed courses are required.'
    case 'course_prerequisite':
      return 'The listed course is required.'
    default:
      return 'The source requirement needs manual review.'
  }
}
