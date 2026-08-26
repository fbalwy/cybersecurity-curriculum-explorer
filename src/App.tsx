import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { CourseInspector } from './components/CourseInspector'
import { Legend } from './components/Legend'
import { LevelView } from './components/LevelView'
import { getPlan } from './data/plans'
import type { FocusMode, PlanKey } from './data/types'

function initialState() {
  const params = new URLSearchParams(window.location.search)
  const planKey: PlanKey = params.get('plan') === 'old' ? 'old' : 'developed'
  const requestedMode = params.get('mode')
  const focusMode: FocusMode =
    requestedMode === 'direct' || requestedMode === 'unlocks' ? requestedMode : 'full'
  const plan = getPlan(planKey)
  const requestedCourse = params.get('course')
  const selectedCode = plan.courses.some((course) => course.code === requestedCourse)
    ? requestedCourse
    : null
  const hideEmptyLevels = params.get('compact') !== '0'

  return { focusMode, hideEmptyLevels, planKey, selectedCode }
}

export default function App() {
  const initial = useMemo(initialState, [])
  const [planKey, setPlanKey] = useState<PlanKey>(initial.planKey)
  const [selectedCode, setSelectedCode] = useState<string | null>(initial.selectedCode)
  const [focusMode, setFocusMode] = useState<FocusMode>(initial.focusMode)
  const [hideEmptyLevels, setHideEmptyLevels] = useState(initial.hideEmptyLevels)

  const plan = getPlan(planKey)
  const selectedCourse = plan.courses.find((course) => course.code === selectedCode) ?? null

  useEffect(() => {
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('plan', planKey)
    if (selectedCode) {
      params.set('course', selectedCode)
      params.set('mode', focusMode)
      params.set('compact', hideEmptyLevels ? '1' : '0')
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [focusMode, hideEmptyLevels, planKey, selectedCode])

  const changePlan = (key: PlanKey) => {
    setPlanKey(key)
    setSelectedCode(null)
    setFocusMode('full')
    document.querySelector('.primary-surface')?.scrollTo({ top: 0 })
  }

  const selectCourse = useCallback((code: string | null, reveal = false) => {
    if (code) setFocusMode('full')
    setSelectedCode(code)
    if (code && reveal) {
      window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
        document
          .querySelector<HTMLElement>(`[data-course-code="${CSS.escape(code)}"]`)
          ?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
      })
    }
  }, [])

  const changeFocusMode = useCallback((mode: FocusMode) => {
    setFocusMode(mode)
    if (!selectedCode) return
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      document
        .querySelector<HTMLElement>(`[data-course-code="${CSS.escape(selectedCode)}"]`)
        ?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
    })
  }, [selectedCode])

  const changeEmptyLevelVisibility = useCallback((hide: boolean) => {
    setHideEmptyLevels(hide)
    if (!selectedCode) return
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      document
        .querySelector<HTMLElement>(`[data-course-code="${CSS.escape(selectedCode)}"]`)
        ?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
    })
  }, [selectedCode])

  return (
    <div className="app-shell" dir="ltr">
      <AppHeader
        onPlanChange={changePlan}
        onReset={() => {
          selectCourse(null)
          setFocusMode('full')
          setHideEmptyLevels(true)
        }}
        onSelectCourse={(code) => selectCourse(code, true)}
        plan={plan}
        planKey={planKey}
        selectedCode={selectedCode}
      />

      <main className="workspace">
        <div
          className="primary-surface"
          onClick={(event) => {
            if (!selectedCode) return
            const target = event.target
            if (target instanceof Element && target.closest('button, a, input, summary')) return
            selectCourse(null)
          }}
        >
          <LevelView
            focusMode={focusMode}
            hideEmptyLevels={hideEmptyLevels}
            onSelectCourse={(code) => selectCourse(code)}
            plan={plan}
            selectedCode={selectedCode}
          />
        </div>

        <CourseInspector
          course={selectedCourse}
          focusMode={focusMode}
          hideEmptyLevels={hideEmptyLevels}
          onClose={() => selectCourse(null)}
          onHideEmptyLevelsChange={changeEmptyLevelVisibility}
          onFocusModeChange={changeFocusMode}
          onSelectCourse={(code) => selectCourse(code, true)}
          plan={plan}
        />
      </main>

      <Legend />
    </div>
  )
}
