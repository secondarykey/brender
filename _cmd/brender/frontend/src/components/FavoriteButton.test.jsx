import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import FavoriteButton from './FavoriteButton'

vi.mock('../lib/api', () => ({
  FavoriteApi: {
    set: vi.fn().mockResolvedValue(true),
  },
}))

import { FavoriteApi } from '../lib/api'

beforeEach(() => {
  vi.clearAllMocks()
  FavoriteApi.set.mockResolvedValue(true)
})

describe('FavoriteButton', () => {
  it('reflects the favorite state via aria-pressed', async () => {
    await renderWithI18n(<FavoriteButton fileID="f1" favorite onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('turns a non-favorite on and reports it optimistically', async () => {
    const onChange = vi.fn()
    await renderWithI18n(<FavoriteButton fileID="f1" favorite={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('f1', true)
    await waitFor(() => {
      expect(FavoriteApi.set).toHaveBeenCalledWith({ fileID: 'f1', favorite: true })
    })
  })

  it('turns a favorite off', async () => {
    const onChange = vi.fn()
    FavoriteApi.set.mockResolvedValue(false)
    await renderWithI18n(<FavoriteButton fileID="f1" favorite onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith('f1', false)
    await waitFor(() => {
      expect(FavoriteApi.set).toHaveBeenCalledWith({ fileID: 'f1', favorite: false })
    })
  })

  it('shows a text label in the row variant', async () => {
    await renderWithI18n(
      <FavoriteButton fileID="f1" favorite={false} onChange={() => {}} variant="row" label />
    )
    expect(screen.getByText('Add to favorites')).toBeInTheDocument()
  })

  it('rolls back when the call fails', async () => {
    const onChange = vi.fn()
    FavoriteApi.set.mockRejectedValue(new Error('boom'))
    await renderWithI18n(<FavoriteButton fileID="f1" favorite={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('f1', false)
    })
    expect(onChange).toHaveBeenNthCalledWith(1, 'f1', true)
  })
})
