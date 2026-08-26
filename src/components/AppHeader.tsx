import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  GraduationCap,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { Course, PlanKey, StudyPlan } from '../data/types'
import { planOptions } from '../data/plans'

interface AppHeaderProps {
  plan: StudyPlan
  planKey: PlanKey
  selectedCode: string | null
  onPlanChange: (key: PlanKey) => void
  onSelectCourse: (code: string) => void
  onReset: () => void
}

export function AppHeader({
  plan,
  planKey,
  selectedCode,
  onPlanChange,
  onSelectCourse,
  onReset,
}: AppHeaderProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const matches = useMemo(() => {
    if (!deferredQuery) return []
    return plan.courses
      .filter(
        (course) =>
          course.code.toLowerCase().includes(deferredQuery) ||
          course.name.toLowerCase().includes(deferredQuery),
      )
      .slice(0, 8)
  }, [deferredQuery, plan.courses])

  useEffect(() => {
    setQuery('')
    setSearchOpen(false)
  }, [planKey])

  const chooseCourse = (course: Course) => {
    onSelectCourse(course.code)
    setQuery('')
    setSearchOpen(false)
  }

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <ShieldCheck size={27} strokeWidth={1.8} />
        </span>
        <div>
          <h1>Cybersecurity Curriculum Explorer</h1>
        </div>
      </div>

      <div className="header-actions">
        <div className="plan-switch" aria-label="Study plan">
          {planOptions.map((option) => (
            <button
              className={planKey === option.key ? 'is-active' : ''}
              key={option.key}
              onClick={() => onPlanChange(option.key)}
              type="button"
            >
              <GraduationCap size={15} aria-hidden="true" />
              <span>{option.label}</span>
              <small>{option.track}</small>
            </button>
          ))}
        </div>

        <div className="course-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search courses"
            onChange={(event) => {
              setQuery(event.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search by code or course name"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear search"
              className="search-clear"
              onClick={() => {
                setQuery('')
                setSearchOpen(false)
              }}
              type="button"
            >
              <X size={15} />
            </button>
          ) : null}
          {searchOpen && deferredQuery ? (
            <div className="search-results" role="listbox">
              {matches.length ? (
                matches.map((course) => (
                  <button key={course.code} onClick={() => chooseCourse(course)} type="button">
                    <span>
                      <strong>{course.code}</strong>
                      {course.name}
                    </span>
                    <small>{course.level ? `Level ${course.level}` : 'Elective option'}</small>
                  </button>
                ))
              ) : (
                <p>No matching courses</p>
              )}
            </div>
          ) : null}
        </div>

        <button
          aria-label="Reset the explorer"
          className="icon-button header-reset"
          disabled={!selectedCode}
          onClick={onReset}
          title="Reset explorer"
          type="button"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  )
}
