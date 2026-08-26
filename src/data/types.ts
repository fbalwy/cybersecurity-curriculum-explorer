export type PlanKey = 'old' | 'developed'

export type CourseKind = 'required' | 'elective_option'

export type RequirementStatus =
  | 'not_specified'
  | 'explicit_none'
  | 'course_prerequisite'
  | 'all_of_courses'
  | 'all_of_courses_and_credits'
  | 'credit_threshold'
  | 'unparsed_text'

export type CategoryGroup =
  | 'university'
  | 'college'
  | 'math-science'
  | 'cybersecurity'
  | 'project-training'
  | 'elective'

export interface Course {
  code: string
  name: string
  kind: CourseKind
  level: number | null
  requirementRaw: string | null
  requirementStatus: RequirementStatus
  prerequisites: string[]
  creditThreshold: number | null
  requirementLogic: 'AND' | null
  categoryRaw: string | null
  categoryGroup: CategoryGroup
  categoryLabel: string
  lectureHours: number | null
  labHours: number | null
  creditHours: number | null
  sourceRange: string
}

export interface UnresolvedRequirement {
  course: string
  missing: string
  raw: string
}

export interface DistributionItem {
  label: string
  credits: number
  sourceCell: string
}

export interface StudyPlan {
  id: string
  key: PlanKey
  label: string
  track: string
  sourceFile: string
  totalCredits: number
  programCredits: number
  levelTotals: Record<string, number>
  distribution: DistributionItem[]
  electiveInstruction: string
  warnings: string[]
  unresolved: UnresolvedRequirement[]
  courses: Course[]
}

export interface PlanDataset {
  generatedFrom: string
  plans: Record<PlanKey, StudyPlan>
}

export type FocusMode = 'direct' | 'full' | 'unlocks'
