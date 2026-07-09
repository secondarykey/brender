import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import Pagination from './Pagination'

describe('Pagination', () => {
  it('returns null when single page and no sizer', async () => {
    const { container } = await renderWithI18n(
      <Pagination page={1} totalPages={1} onChange={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders page buttons', async () => {
    await renderWithI18n(
      <Pagination page={2} totalPages={5} onChange={() => {}} />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2 / 5 page')).toBeInTheDocument()
  })

  it('calls onChange with page number', async () => {
    const onChange = vi.fn()
    await renderWithI18n(
      <Pagination page={1} totalPages={5} onChange={onChange} />
    )
    await userEvent.click(screen.getByText('3'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('disables prev button on first page', async () => {
    await renderWithI18n(
      <Pagination page={1} totalPages={5} onChange={() => {}} />
    )
    expect(screen.getByText('‹')).toBeDisabled()
  })

  it('disables next button on last page', async () => {
    await renderWithI18n(
      <Pagination page={5} totalPages={5} onChange={() => {}} />
    )
    expect(screen.getByText('›')).toBeDisabled()
  })

  it('renders page size selector when props provided', async () => {
    const onPageSizeChange = vi.fn()
    await renderWithI18n(
      <Pagination page={1} totalPages={3} onChange={() => {}} pageSize={10} onPageSizeChange={onPageSizeChange} total={25} />
    )
    expect(screen.getByText('25 items')).toBeInTheDocument()
    expect(screen.getByText('per page')).toBeInTheDocument()
  })

  it('renders even with single page when sizer is present', async () => {
    await renderWithI18n(
      <Pagination page={1} totalPages={1} onChange={() => {}} pageSize={10} onPageSizeChange={() => {}} total={5} />
    )
    expect(screen.getByText('5 items')).toBeInTheDocument()
  })
})
