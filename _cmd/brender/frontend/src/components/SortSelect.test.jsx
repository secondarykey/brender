import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import SortSelect from './SortSelect'

describe('SortSelect', () => {
  it('renders default options', async () => {
    await renderWithI18n(<SortSelect value="name" onChange={() => {}} />)
    const select = screen.getByRole('combobox')
    expect(select.value).toBe('name')
    expect(select.options).toHaveLength(4)
  })

  it('calls onChange when selection changes', async () => {
    const onChange = vi.fn()
    await renderWithI18n(<SortSelect value="name" onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'created_at')
    expect(onChange).toHaveBeenCalledWith('created_at')
  })

  it('renders direction toggle when onDirChange provided', async () => {
    const onDirChange = vi.fn()
    await renderWithI18n(<SortSelect value="name" onChange={() => {}} dir="asc" onDirChange={onDirChange} />)
    const btn = screen.getByTitle('Ascending')
    await userEvent.click(btn)
    expect(onDirChange).toHaveBeenCalledWith('desc')
  })

  it('does not render direction toggle without onDirChange', async () => {
    await renderWithI18n(<SortSelect value="name" onChange={() => {}} />)
    expect(screen.queryByTitle('Ascending')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Descending')).not.toBeInTheDocument()
  })

  it('shows desc arrow when dir is desc', async () => {
    await renderWithI18n(<SortSelect value="name" onChange={() => {}} dir="desc" onDirChange={() => {}} />)
    expect(screen.getByTitle('Descending')).toBeInTheDocument()
  })

  it('uses custom options', async () => {
    await renderWithI18n(<SortSelect value="name" onChange={() => {}} options={['name', 'created_at']} />)
    expect(screen.getByRole('combobox').options).toHaveLength(2)
  })
})
