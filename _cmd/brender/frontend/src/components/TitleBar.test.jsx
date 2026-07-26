import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithI18n } from '../test/helpers'
import TitleBar from './TitleBar'

vi.mock('@wailsio/runtime', () => ({
  Window: {
    Close: vi.fn(),
    Minimise: vi.fn(),
    ToggleMaximise: vi.fn(),
  },
}))

vi.mock('../lib/api', () => ({
  QueueApi: {
    list: vi.fn().mockResolvedValue([]),
    killRunning: vi.fn().mockResolvedValue(null),
  },
  EnvironmentApi: {
    getVersion: vi.fn().mockResolvedValue({ version: '0.1.0', dev: false }),
    get: vi.fn().mockResolvedValue({ server: false }),
  },
}))

vi.mock('./appicon.png', () => ({ default: 'appicon.png' }))

beforeEach(() => { vi.clearAllMocks() })

describe('TitleBar', () => {
  it('renders the app icon', async () => {
    await renderWithI18n(<TitleBar />)
    const icon = document.querySelector('.titlebar-icon')
    expect(icon).toBeInTheDocument()
  })

  it('renders window control buttons', async () => {
    await renderWithI18n(<TitleBar />)
    expect(screen.getByTitle('Minimize')).toBeInTheDocument()
    expect(screen.getByTitle('Maximize')).toBeInTheDocument()
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })

  it('shows DEV version when dev flag is true', async () => {
    const { EnvironmentApi } = await import('../lib/api')
    EnvironmentApi.getVersion.mockResolvedValueOnce({ version: '0.2.0', dev: true })
    EnvironmentApi.get.mockResolvedValueOnce({ server: false })

    await renderWithI18n(<TitleBar />)
    await waitFor(() => {
      expect(screen.getByText('0.2.0+DEV')).toBeInTheDocument()
    })
  })

  it('shows server label in server mode', async () => {
    const { EnvironmentApi } = await import('../lib/api')
    EnvironmentApi.getVersion.mockResolvedValueOnce({ version: '0.1.0', dev: false })
    EnvironmentApi.get.mockResolvedValueOnce({ server: true, server_host: 'localhost', server_port: 9090 })

    await renderWithI18n(<TitleBar />)
    await waitFor(() => {
      expect(screen.getByText('ServerMode(localhost:9090)')).toBeInTheDocument()
    })
  })
})
