import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('curriculum focus interactions', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?plan=developed')
  })

  it('opens every course in direct-prerequisite mode and offers an explicit back action', () => {
    const view = render(<App />)

    fireEvent.click(view.container.querySelector('[data-course-code="CS114"]')!)

    expect(screen.getByRole('region', { name: 'Focused direct prerequisite for CS114' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Direct prerequisite' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Back to full plan' })).toBeInTheDocument()
    expect(view.container.querySelector('.curriculum-view-enter')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Hide empty levels' })).toBeChecked()
    expect(view.container.querySelectorAll('.focused-flow-stage')).toHaveLength(2)
    expect(view.container.querySelector('[data-level-layout="compact"]')).toBeInTheDocument()
    expect(window.location.search).toContain('mode=direct')
    expect(window.location.search).toContain('compact=1')
    expect(screen.queryByText('Source record')).not.toBeInTheDocument()
    expect(screen.queryByText(/The source instructs students/)).not.toBeInTheDocument()
    expect(view.container.querySelector('.focused-flow-stage .level-band__label > span')).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide empty levels' }))
    expect(screen.getByRole('checkbox', { name: 'Hide empty levels' })).not.toBeChecked()
    expect(view.container.querySelector('[data-level-layout="all"]')).toBeInTheDocument()
    expect(window.location.search).toContain('compact=0')

    fireEvent.click(screen.getByRole('button', { name: 'Back to full plan' }))

    expect(screen.getByRole('region', { name: 'Interactive study plan by level' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Details for CS114' })).not.toBeInTheDocument()

    fireEvent.click(view.container.querySelector('[data-course-code="CS114"]')!)
    fireEvent.click(view.container.querySelector('.focused-flow-stage__courses')!)
    expect(screen.getByRole('region', { name: 'Interactive study plan by level' })).toBeInTheDocument()
  })

  it('preserves an explicitly requested focus mode from the URL', () => {
    window.history.replaceState(null, '', '/?plan=developed&course=CS114&mode=full&compact=1')

    render(<App />)

    expect(screen.getByRole('region', { name: 'Focused full path for CS114' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'true')
  })
})
