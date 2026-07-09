import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import MovieTitleBar from './MovieTitleBar'

vi.mock('../lib/api/_client', () => ({
  isWails: vi.fn().mockReturnValue(false),
}))

describe('MovieTitleBar', () => {
  it('renders title', async () => {
    await renderWithI18n(<MovieTitleBar title="movie.mp4" showInfo onToggleInfo={() => {}} />)
    expect(screen.getByText('movie.mp4')).toBeInTheDocument()
  })

  it('renders info toggle button', async () => {
    const onToggleInfo = vi.fn()
    await renderWithI18n(<MovieTitleBar title="test" showInfo onToggleInfo={onToggleInfo} />)
    await userEvent.click(screen.getByTitle('情報を表示/非表示'))
    expect(onToggleInfo).toHaveBeenCalledOnce()
  })

  it('renders close button', async () => {
    await renderWithI18n(<MovieTitleBar title="test" showInfo onToggleInfo={() => {}} />)
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })

  it('does not render min/max buttons in non-wails mode', async () => {
    await renderWithI18n(<MovieTitleBar title="test" showInfo onToggleInfo={() => {}} />)
    expect(screen.queryByTitle('Minimize')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument()
  })
})
