import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('curriculum focus interactions', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?plan=developed')
  })

  it('opens every course in full-path mode and returns to the plan from empty space', () => {
    const view = render(<App />)

    fireEvent.click(view.container.querySelector('[data-course-code="CS114"]')!)

    expect(screen.getByRole('region', { name: 'Focused full path for CS114' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.container.querySelector('.curriculum-view-enter')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide empty levels' }))

    expect(screen.getByRole('checkbox', { name: 'Hide empty levels' })).toBeChecked()
    expect(view.container.querySelectorAll('.focused-flow-stage')).toHaveLength(4)
    expect(view.container.querySelector('[data-level-layout="compact"]')).toBeInTheDocument()
    expect(window.location.search).toContain('compact=1')

    fireEvent.click(view.container.querySelector('.focused-flow-stage__courses')!)

    expect(screen.getByRole('region', { name: 'Interactive study plan by level' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Details for CS114' })).not.toBeInTheDocument()
  })
})
