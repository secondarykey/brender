import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import HoldButton from './HoldButton'

describe('HoldButton', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders children', () => {
    render(<HoldButton onClick={() => {}}>Hold Me</HoldButton>)
    expect(screen.getByText('Hold Me')).toBeInTheDocument()
  })

  it('fires onClick after holding for ms duration', () => {
    const onClick = vi.fn()
    render(<HoldButton onClick={onClick} ms={500}>Go</HoldButton>)
    const btn = screen.getByRole('button')
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(500) })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick if released early', () => {
    const onClick = vi.fn()
    render(<HoldButton onClick={onClick} ms={500}>Go</HoldButton>)
    const btn = screen.getByRole('button')
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseUp(btn)
    act(() => { vi.advanceTimersByTime(500) })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not start when disabled', () => {
    const onClick = vi.fn()
    render(<HoldButton onClick={onClick} ms={500} disabled>Go</HoldButton>)
    const btn = screen.getByRole('button')
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(600) })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows help text when released early', () => {
    const onClick = vi.fn()
    render(<HoldButton onClick={onClick} ms={500} helpText="Keep holding">Go</HoldButton>)
    const btn = screen.getByRole('button')
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.mouseUp(btn)
    expect(screen.getByText('Keep holding')).toBeInTheDocument()
  })

  it('cancels on mouse leave', () => {
    const onClick = vi.fn()
    render(<HoldButton onClick={onClick} ms={500}>Go</HoldButton>)
    const btn = screen.getByRole('button')
    fireEvent.mouseDown(btn)
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.mouseLeave(btn)
    act(() => { vi.advanceTimersByTime(500) })
    expect(onClick).not.toHaveBeenCalled()
  })
})
