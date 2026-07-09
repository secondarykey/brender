import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Breadcrumb from './Breadcrumb'

describe('Breadcrumb', () => {
  it('renders items separated by ›', () => {
    render(<Breadcrumb items={[
      { label: 'Home' },
      { label: 'Project' },
    ]} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('renders clickable items as buttons', async () => {
    const onClick = vi.fn()
    render(<Breadcrumb items={[
      { label: 'Home', onClick },
      { label: 'Current' },
    ]} />)
    const btn = screen.getByText('Home')
    expect(btn.tagName).toBe('BUTTON')
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders non-clickable items as spans', () => {
    render(<Breadcrumb items={[{ label: 'Static' }]} />)
    const el = screen.getByText('Static')
    expect(el.tagName).toBe('SPAN')
  })

  it('renders suffix when provided', () => {
    render(<Breadcrumb items={[
      { label: 'Item', suffix: <span data-testid="sfx">!</span> },
    ]} />)
    expect(screen.getByTestId('sfx')).toBeInTheDocument()
  })
})
