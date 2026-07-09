import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import AccessDenied from './AccessDenied'

describe('AccessDenied', () => {
  it('renders access denied message', async () => {
    await renderWithI18n(<AccessDenied />)
    expect(screen.getByText('Access denied')).toBeInTheDocument()
  })

  it('renders back button when onBack provided', async () => {
    const onBack = vi.fn()
    await renderWithI18n(<AccessDenied onBack={onBack} />)
    const btn = screen.getByText('Back')
    expect(btn).toBeInTheDocument()
    await userEvent.click(btn)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('does not render back button when onBack not provided', async () => {
    await renderWithI18n(<AccessDenied />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })
})
