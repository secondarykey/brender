import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import TagInput from './TagInput'

vi.mock('../lib/api', () => ({
  TagApi: {
    listTags: vi.fn().mockResolvedValue([
      { id: 't1', name: 'bug', color: '#f00' },
      { id: 't2', name: 'feature', color: '#0f0' },
      { id: 't3', name: 'docs', color: '#00f', category_name: 'type' },
    ]),
    assignTagByInput: vi.fn().mockImplementation(({ input }) =>
      Promise.resolve({ id: `new-${input}`, name: input, color: '#999' })
    ),
    removeTagFromFile: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TagInput', () => {
  it('renders existing tags as chips', async () => {
    const tags = [{ id: 't1', name: 'bug', color: '#f00' }]
    await renderWithI18n(<TagInput projectFileID="f1" tags={tags} onTagsChanged={() => {}} />)
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  it('shows placeholder when no tags', async () => {
    await renderWithI18n(<TagInput projectFileID="f1" tags={[]} onTagsChanged={() => {}} />)
    expect(screen.getByPlaceholderText('Add tag...')).toBeInTheDocument()
  })

  it('shows suggestions when typing', async () => {
    const { TagApi } = await import('../lib/api')
    await renderWithI18n(<TagInput projectFileID="f1" tags={[]} onTagsChanged={() => {}} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'bu')

    await waitFor(() => {
      expect(screen.getByText('bug')).toBeInTheDocument()
    })
  })

  it('filters out already assigned tags from suggestions', async () => {
    const tags = [{ id: 't1', name: 'bug', color: '#f00' }]
    await renderWithI18n(<TagInput projectFileID="f1" tags={tags} onTagsChanged={() => {}} />)

    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'b')

    await waitFor(() => {
      // 'bug' should not appear in suggestions since already assigned
      const suggestions = document.querySelectorAll('.tag-autocomplete-item')
      const texts = Array.from(suggestions).map(s => s.textContent)
      expect(texts).not.toContain('bug')
    })
  })

  it('calls removeTagFromFile and onTagsChanged on × click', async () => {
    const { TagApi } = await import('../lib/api')
    const onTagsChanged = vi.fn()
    const tags = [{ id: 't1', name: 'bug', color: '#f00' }]
    await renderWithI18n(<TagInput projectFileID="f1" tags={tags} onTagsChanged={onTagsChanged} />)

    await userEvent.click(document.querySelector('.tag-chip-remove'))

    await waitFor(() => {
      expect(TagApi.removeTagFromFile).toHaveBeenCalledWith({ projectFileID: 'f1', tagID: 't1' })
      expect(onTagsChanged).toHaveBeenCalledWith([])
    })
  })

  it('shows category prefix in tag label', async () => {
    const tags = [{ id: 't3', name: 'docs', color: '#00f', category_name: 'type' }]
    await renderWithI18n(<TagInput projectFileID="f1" tags={tags} onTagsChanged={() => {}} />)
    expect(screen.getByText('type:docs')).toBeInTheDocument()
  })
})
