import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import ConfirmDialog from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders title and children', async () => {
    await renderWithI18n(
      <ConfirmDialog open title="Confirm?" onConfirm={() => {}} onCancel={() => {}}>
        <p>Are you sure?</p>
      </ConfirmDialog>
    )
    expect(screen.getByText('Confirm?')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn()
    await renderWithI18n(
      <ConfirmDialog open title="T" onConfirm={onConfirm} onCancel={() => {}} confirmLabel="Yes" />
    )
    await userEvent.click(screen.getByText('Yes'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn()
    await renderWithI18n(
      <ConfirmDialog open title="T" onConfirm={() => {}} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables buttons when busy', async () => {
    await renderWithI18n(
      <ConfirmDialog open title="T" onConfirm={() => {}} onCancel={() => {}} busy confirmLabel="OK" />
    )
    expect(screen.getByText('OK')).toBeDisabled()
    expect(screen.getByText('Cancel')).toBeDisabled()
  })

  it('uses default labels from i18n', async () => {
    await renderWithI18n(
      <ConfirmDialog open title="T" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('renders nothing when open is false', async () => {
    const { container } = await renderWithI18n(
      <ConfirmDialog open={false} title="T" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(container.querySelector('.dialog-overlay')).not.toBeInTheDocument()
  })

  it('shows message when provided', async () => {
    await renderWithI18n(
      <ConfirmDialog open title="T" onConfirm={() => {}} onCancel={() => {}} message="Oops" />
    )
    expect(screen.getByText('Oops')).toBeInTheDocument()
  })
})
