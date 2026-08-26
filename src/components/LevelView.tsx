import { useLayoutEffect, useMemo, useRef } from 'react'
import { AlertTriangle, ArrowDown, GitBranch } from 'lucide-react'
import type { Course, FocusMode, StudyPlan } from '../data/types'
import { unresolvedForCourse } from '../lib/graph'
import { FocusedFlowView } from './FocusedFlowView'

interface LevelViewProps {
  plan: StudyPlan
  selectedCode: string | null
  focusMode: FocusMode
  hideEmptyLevels: boolean
  onSelectCourse: (code: string) => void
}

function LevelCourseCard({
  course,
  onSelect,
  unresolved,
}: {
  course: Course
  onSelect: (code: string) => void
  unresolved: boolean
}) {
  return (
    <button
      aria-pressed="false"
      className={`level-course-card category-${course.categoryGroup} level-relation-neutral`}
      data-course-code={course.code}
      data-relation="neutral"
      onClick={() => onSelect(course.code)}
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

function captureCardRects(scope: HTMLElement | null): Map<string, DOMRect> {
  if (!scope) return new Map()
  return new Map(
    [...scope.querySelectorAll<HTMLElement>('[data-course-code]')].flatMap((card) => {
      const code = card.dataset.courseCode
      return code ? [[code, card.getBoundingClientRect()] as const] : []
    }),
  )
}

function DefaultLevelView({
  plan,
  onSelectCourse,
}: Pick<LevelViewProps, 'plan' | 'onSelectCourse'>) {
  const required = useMemo(
    () => plan.courses.filter((course) => course.kind === 'required'),
    [plan.courses],
  )
  const electives = useMemo(
    () => plan.courses.filter((course) => course.kind === 'elective_option'),
    [plan.courses],
  )

  return (
    <section className="level-view level-view--default curriculum-view-enter" aria-label="Interactive study plan by level">
      <div className="level-view__intro">
        <div>
          <span className="level-view__eyebrow">{plan.id}</span>
          <h2>{plan.label}</h2>
          <p>Select a course to transform the plan into a centered prerequisite flow.</p>
        </div>
        <div className="level-view__summary">
          <GitBranch size={16} aria-hidden="true" />
          <strong>{plan.totalCredits}</strong>
          <span>total credits</span>
        </div>
      </div>

      <div className="curriculum-content">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => {
          const courses = required.filter((course) => course.level === level)
          return (
            <section className="level-band" id={`level-${level}`} key={level}>
              <div className="level-band__label">
                <span>{String(level).padStart(2, '0')}</span>
                <div>
                  <strong>Level {level}</strong>
                  <small>{plan.levelTotals[String(level)]} credits</small>
                </div>
                <ArrowDown aria-hidden="true" size={15} />
              </div>
              <div className="level-band__courses">
                {courses.map((course) => (
                  <LevelCourseCard
                    course={course}
                    key={course.code}
                    onSelect={onSelectCourse}
                    unresolved={unresolvedForCourse(plan, course.code).length > 0}
                  />
                ))}
              </div>
            </section>
          )
        })}

        <section className="elective-catalog" id="elective-catalog">
          <div className="elective-catalog__heading">
            <div>
              <span>E</span>
              <div>
                <strong>Specialization elective catalog</strong>
                <small>{electives.length} source-listed options</small>
              </div>
            </div>
            <p>Selecting an option shows the prerequisite of the actual course, not the generic plan slot.</p>
          </div>
          <div className="elective-grid">
            {electives.map((course) => (
              <LevelCourseCard
                course={course}
                key={course.code}
                onSelect={onSelectCourse}
                unresolved={unresolvedForCourse(plan, course.code).length > 0}
              />
            ))}
          </div>
        </section>

        {plan.warnings.map((warning) => (
          <div className="plan-warning" key={warning}>
            <AlertTriangle size={17} aria-hidden="true" />
            <span>{warning}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LevelView({ plan, selectedCode, focusMode, hideEmptyLevels, onSelectCourse }: LevelViewProps) {
  const scopeRef = useRef<HTMLDivElement>(null)
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const scope = scopeRef.current
    const previousRects = previousRectsRef.current
    const currentCards = [...(scope?.querySelectorAll<HTMLElement>('[data-course-code]') ?? [])]
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    if (!reducedMotion && previousRects.size) {
      currentCards.forEach((card) => {
        if (typeof card.animate !== 'function') return
        const code = card.dataset.courseCode
        const previous = code ? previousRects.get(code) : undefined
        const current = card.getBoundingClientRect()
        const animation = previous
          ? card.animate(
              [
                {
                  opacity: 0.82,
                  transform: `translate(${previous.left - current.left}px, ${previous.top - current.top}px)`,
                },
                { opacity: 1, transform: 'translate(0, 0)' },
              ],
              { duration: 460, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
            )
          : card.animate(
              [
                { opacity: 0, transform: 'translateY(-10px) scale(0.97)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' },
              ],
              { duration: 320, delay: 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
            )
        void animation.finished.then(() => animation.cancel()).catch(() => undefined)
      })
    }

    previousRectsRef.current = captureCardRects(scope)
    return () => {
      previousRectsRef.current = captureCardRects(scopeRef.current)
    }
  }, [focusMode, hideEmptyLevels, plan.key, selectedCode])

  return (
    <div className="level-view-transition-scope" ref={scopeRef}>
      {selectedCode ? (
        <FocusedFlowView
          focusMode={focusMode}
          hideEmptyLevels={hideEmptyLevels}
          key={`${selectedCode}-${focusMode}-${hideEmptyLevels ? 'compact' : 'all'}`}
          onSelectCourse={onSelectCourse}
          plan={plan}
          selectedCode={selectedCode}
        />
      ) : (
        <DefaultLevelView onSelectCourse={onSelectCourse} plan={plan} />
      )}
    </div>
  )
}
