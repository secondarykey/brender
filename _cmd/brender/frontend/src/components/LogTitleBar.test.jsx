import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import LogTitleBar from './LogTitleBar'

vi.mock('../lib/api/_client', () => ({
  isWails: vi.fn().mockReturnValue(false),
}))

describe('LogTitleBar', () => {
  it('renders title', async () => {
    await renderWithI18n(<LogTitleBar title="render.log" />)
    expect(screen.getByText('render.log')).toBeInTheDocument()
  })

  it('renders close button in non-wails mode', async () => {
    await renderWithI18n(<LogTitleBar title="test" />)
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })

  it('renders download button when onDownload provided', async () => {
    const onDownload = vi.fn()
    await renderWithI18n(<LogTitleBar title="test" onDownload={onDownload} />)
    const btn = screen.getByTitle('Download')
    await userEvent.click(btn)
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it('does not render download button without onDownload', async () => {
    await renderWithI18n(<LogTitleBar title="test" />)
    expect(screen.queryByTitle('Download')).not.toBeInTheDocument()
  })

  it('renders log level selector when provided', async () => {
    const onLogLevelChange = vi.fn()
    await renderWithI18n(
      <LogTitleBar
        title="test"
        logLevel="INFO"
        logLevels={['DEBUG', 'INFO', 'WARN']}
        onLogLevelChange={onLogLevelChange}
      />
    )
    const select = screen.getByTitle('Log Level')
    expect(select.value).toBe('INFO')
  })

  it('does not render log level selector without props', async () => {
    await renderWithI18n(<LogTitleBar title="test" />)
    expect(screen.queryByTitle('Log Level')).not.toBeInTheDocument()
  })
})
