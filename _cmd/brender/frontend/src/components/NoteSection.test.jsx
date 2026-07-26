import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import NoteSection from './NoteSection'

describe('NoteSection', () => {
  it('starts collapsed when value is empty', async () => {
    await renderWithI18n(<NoteSection value="" onChange={() => {}} />)
    expect(screen.getByText('Note')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('starts open when value is non-empty', async () => {
    await renderWithI18n(<NoteSection value="Hello" onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox').value).toBe('Hello')
  })

  it('toggles open/closed on click', async () => {
    await renderWithI18n(<NoteSection value="" onChange={() => {}} />)
    await userEvent.click(screen.getByText('Note'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Note'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const onChange = vi.fn()
    await renderWithI18n(<NoteSection value="" onChange={onChange} />)
    await userEvent.click(screen.getByText('Note'))
    await userEvent.type(screen.getByRole('textbox'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('shows ellipsis when collapsed with content', async () => {
    const { container } = await renderWithI18n(<NoteSection value="Some text" onChange={() => {}} />)
    // Collapse it first
    await userEvent.click(screen.getByText('Note'))
    expect(screen.getByText('…')).toBeInTheDocument()
  })
})
