import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Dialog from './Dialog'

describe('Dialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<Dialog open={false} title="Hidden" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders title and children when open', () => {
    render(<Dialog open title="My Title"><p>Body</p></Dialog>)
    expect(screen.getByText('My Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('renders actions in footer', () => {
    render(<Dialog open title="T" actions={<button>Save</button>} />)
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('renders message with severity class', () => {
    render(<Dialog open message="Error occurred" messageSeverity="error" />)
    const msg = screen.getByText('Error occurred')
    expect(msg.className).toContain('dialog-message-error')
  })

  it('calls onClose on Escape when closeOnBackdrop is true', () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} closeOnBackdrop />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on Escape when closeOnBackdrop is false', () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} closeOnBackdrop={false} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} closeOnBackdrop />)
    const overlay = document.querySelector('.dialog-overlay')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when clicking dialog content', () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} closeOnBackdrop title="T" />)
    const dialog = document.querySelector('.dialog')
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies wide class', () => {
    render(<Dialog open wide title="Wide" />)
    expect(document.querySelector('.dialog-wide')).toBeInTheDocument()
  })
})
