import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  GitBranch,
  ListFilter,
  Route,
  Rows3,
  X,
} from 'lucide-react'
import type { Course, FocusMode, StudyPlan } from '../data/types'
import {
  ancestors,
  directDependents,
  sortedCourses,
  sourceRequirementLabel,
  unresolvedForCourse,
} from '../lib/graph'

interface CourseInspectorProps {
  plan: StudyPlan
  course: Course | null
  focusMode: FocusMode
  hideEmptyLevels: boolean
  onFocusModeChange: (mode: FocusMode) => void
  onHideEmptyLevelsChange: (hide: boolean) => void
  onSelectCourse: (code: string) => void
  onClose: () => void
}

const modeOptions: Array<{ mode: FocusMode; label: string; ariaLabel: string; icon: typeof CircleDot }> = [
  { mode: 'direct', label: 'Direct prerequisite', ariaLabel: 'Direct prerequisite', icon: CircleDot },
  { mode: 'full', label: 'Full path', ariaLabel: 'Full path', icon: Route },
  { mode: 'direct-unlocks', label: 'Unlocks directly', ariaLabel: 'Courses it unlocks directly', icon: ArrowRight },
  { mode: 'unlocks', label: 'Courses it unlocks', ariaLabel: 'Courses it unlocks', icon: GitBranch },
]

function CourseLink({
  course,
  accent,
  onSelect,
}: {
  course: Course
  accent: 'purple' | 'teal'
  onSelect: (code: string) => void
}) {
  return (
    <button className={`inspector-course inspector-course--${accent}`} onClick={() => onSelect(course.code)} type="button">
      <span>
        <strong>{course.code}</strong>
        {course.name}
      </span>
      <small>{course.creditHours == null ? 'Credits not stated' : `${course.creditHours} credits`}</small>
      <ArrowRight aria-hidden="true" size={16} />
    </button>
  )
}

function PlanOverview({ plan }: { plan: StudyPlan }) {
  const requiredCount = plan.courses.filter((course) => course.kind === 'required').length
  const electiveCount = plan.courses.filter((course) => course.kind === 'elective_option').length

  return (
    <div className="inspector-overview">
      <div className="overview-mark">
        <BookOpenCheck size={24} aria-hidden="true" />
      </div>
      <h2>{plan.label}</h2>
      <p>
        Select any course to isolate its verified prerequisites and the courses it directly unlocks.
      </p>
      <div className="overview-stats">
        <div>
          <strong>{plan.totalCredits}</strong>
          <span>Total credits</span>
        </div>
        <div>
          <strong>{requiredCount}</strong>
          <span>Plan courses</span>
        </div>
        <div>
          <strong>{electiveCount}</strong>
          <span>Elective options</span>
        </div>
      </div>
      <div className="source-principle">
        <CheckCircle2 size={17} aria-hidden="true" />
        <span>Every arrow is derived only from an explicit course code in the source Req cell.</span>
      </div>
    </div>
  )
}

export function CourseInspector({
  plan,
  course,
  focusMode,
  hideEmptyLevels,
  onFocusModeChange,
  onHideEmptyLevelsChange,
  onSelectCourse,
  onClose,
}: CourseInspectorProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  useEffect(() => {
    setMobileExpanded(false)
  }, [course?.code])

  useEffect(() => {
    if (!course) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [course, onClose])

  if (!course) {
    return (
      <aside className="course-inspector course-inspector--overview" aria-label="Plan overview">
        <PlanOverview plan={plan} />
      </aside>
    )
  }

  const index = new Map(plan.courses.map((item) => [item.code, item]))
  const directPrerequisites = course.prerequisites.map((code) => ({ code, course: index.get(code) }))
  const previousPath = sortedCourses(
    [...ancestors(plan, course.code)].map((code) => index.get(code)).filter((item): item is Course => Boolean(item)),
  )
  const unlocks = sortedCourses(directDependents(plan, course.code))
  const unresolved = unresolvedForCourse(plan, course.code)
  const isPlaceholder = /^CYB[1-4]$/.test(course.code) || /^GSE\d$/.test(course.code) || /^FF\d$/.test(course.code)
  const activeModeLabel = modeOptions.find(({ mode }) => mode === focusMode)?.label ?? 'Course relationships'

  return (
    <aside
      className={`course-inspector${mobileExpanded ? ' course-inspector--mobile-expanded' : ''}`}
      aria-label={`Details for ${course.code}`}
    >
      <button
        aria-controls="mobile-course-inspector-content"
        aria-expanded={mobileExpanded}
        aria-label={`${mobileExpanded ? 'Collapse' : 'Expand'} course details for ${course.code}`}
        className="course-inspector__mobile-toggle"
        onClick={() => setMobileExpanded((expanded) => !expanded)}
        type="button"
      >
        <span className="mobile-inspector-handle" aria-hidden="true" />
        <span className="mobile-inspector-course">
          <strong>{course.code}</strong>
          <span>{course.name}</span>
        </span>
        <span className="mobile-inspector-mode">{activeModeLabel}</span>
        {mobileExpanded ? <ChevronDown aria-hidden="true" size={19} /> : <ChevronUp aria-hidden="true" size={19} />}
      </button>

      <div className="course-inspector__content" id="mobile-course-inspector-content">
      <div className="inspector-heading">
        <div>
          <span>{course.categoryLabel}</span>
          <h2>{course.code}</h2>
          <p>{course.name}</p>
        </div>
        <button aria-label="Close course details" className="icon-button" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      <div className="focus-tabs" aria-label="Relationship focus" role="group">
        {modeOptions.map(({ mode, label, ariaLabel, icon: Icon }) => (
          <button
            aria-label={ariaLabel}
            aria-controls="curriculum-focus-view"
            aria-pressed={focusMode === mode}
            className={focusMode === mode ? 'is-active' : ''}
            key={mode}
            onClick={() => onFocusModeChange(mode)}
            title={ariaLabel}
            type="button"
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <label className="compact-levels-control">
        <span className="compact-levels-copy">
          <ListFilter aria-hidden="true" size={17} />
          <span>
            <strong>Hide empty levels</strong>
            <small>Show only levels containing related courses</small>
          </span>
        </span>
        <input
          aria-label="Hide empty levels"
          checked={hideEmptyLevels}
          onChange={(event) => onHideEmptyLevelsChange(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className="compact-levels-switch">
          <span />
        </span>
      </label>

      <div className="course-facts">
        <div>
          <span>Level</span>
          <strong>{course.level ?? 'Elective'}</strong>
        </div>
        <div>
          <span>Credit hours</span>
          <strong>{course.creditHours ?? 'Not stated'}</strong>
        </div>
        <div>
          <span>Lecture / lab</span>
          <strong>
            {course.lectureHours ?? '—'} / {course.labHours ?? '—'}
          </strong>
        </div>
      </div>

      {unresolved.map((item) => (
        <div className="inspector-warning inspector-warning--strong" key={`${item.course}-${item.missing}`}>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>
            <strong>Unresolved prerequisite: {item.missing}.</strong> This code is not present in {plan.label}; no substitution has been assumed.
          </span>
        </div>
      ))}

      {isPlaceholder ? (
        <div className="inspector-warning">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>This is a plan slot. The actual selected course may have its own prerequisite.</span>
        </div>
      ) : null}

      {course.code === 'CYB486' && plan.key === 'developed' ? (
        <div className="inspector-warning">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>The course credit cell is blank; Level 10 totals 6 credits in the source.</span>
        </div>
      ) : null}

      <section className="inspector-section inspector-section--mode">
        <div className="section-title">
          <CircleDot size={18} aria-hidden="true" />
          <h3>Direct prerequisites</h3>
          <span>{directPrerequisites.length + (course.creditThreshold ? 1 : 0)}</span>
        </div>
        {directPrerequisites.length ? (
          directPrerequisites.map(({ code, course: prerequisite }) =>
            prerequisite ? (
              <CourseLink accent="purple" course={prerequisite} key={code} onSelect={onSelectCourse} />
            ) : (
              <div className="missing-course" key={code}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>{code}</strong>
                  Unresolved course code
                </span>
              </div>
            ),
          )
        ) : course.creditThreshold ? null : (
          <p className="empty-relation">{sourceRequirementLabel(course)}</p>
        )}
        {course.creditThreshold ? (
          <div className="credit-condition">
            <Rows3 size={17} aria-hidden="true" />
            <span>
              <strong>{course.creditThreshold} earned credits</strong>
              Required in addition to any listed courses
            </span>
          </div>
        ) : null}
      </section>

      <section className="inspector-section inspector-section--mode">
        <div className="section-title">
          <Route size={18} aria-hidden="true" />
          <h3>Previous path</h3>
          <span>{previousPath.length}</span>
        </div>
        {previousPath.length ? (
          <div className="path-strip" aria-label={`Previous prerequisite path to ${course.code}`}>
            {previousPath.map((item) => (
              <button
                key={item.code}
                onClick={() => onSelectCourse(item.code)}
                title={item.name}
                type="button"
              >
                {item.code}
              </button>
            ))}
            <strong>{course.code}</strong>
          </div>
        ) : (
          <p className="empty-relation">No earlier course path is recorded for {course.code}.</p>
        )}
      </section>

      <section className="inspector-section inspector-section--mode">
        <div className="section-title">
          <GitBranch size={18} aria-hidden="true" />
          <h3>Directly unlocks</h3>
          <span>{unlocks.length}</span>
        </div>
        {unlocks.length ? (
          unlocks.map((item) => (
            <CourseLink accent="teal" course={item} key={item.code} onSelect={onSelectCourse} />
          ))
        ) : (
          <p className="empty-relation">No course in this plan lists {course.code} as a prerequisite.</p>
        )}
      </section>
      </div>
    </aside>
  )
}
