import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import SystemStats from './SystemStats'

vi.mock('../lib/appEvents', () => {
  let listeners = {}
  return {
    onAppEvent: vi.fn((name, cb) => {
      if (!listeners[name]) listeners[name] = []
      listeners[name].push(cb)
      return () => {
        listeners[name] = listeners[name].filter(fn => fn !== cb)
      }
    }),
    __emit: (name, data) => {
      (listeners[name] || []).forEach(cb => cb(data))
    },
    __reset: () => { listeners = {} },
  }
})

let testI18n

beforeEach(async () => {
  const { __reset } = await import('../lib/appEvents')
  __reset()

  testI18n = i18n.createInstance()
  await testI18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: {
          sysmon: { memory: 'Memory' },
        },
      },
    },
    lng: 'en',
    interpolation: { escapeValue: false },
  })
})

function renderWithI18n(ui) {
  return render(
    <I18nextProvider i18n={testI18n}>
      {ui}
    </I18nextProvider>
  )
}

describe('SystemStats', () => {
  it('renders nothing when no stats received', () => {
    const { container } = renderWithI18n(<SystemStats />)
    expect(container.innerHTML).toBe('')
  })

  it('renders CPU and Memory bars when stats arrive', async () => {
    const { __emit } = await import('../lib/appEvents')

    renderWithI18n(<SystemStats />)

    act(() => {
      __emit('system:stats', {
        cpu_usage: 45.2,
        mem_usage: 62.8,
        mem_total_mb: 32768,
        mem_used_mb: 20578,
        gpu_available: false,
        gpus: [],
      })
    })

    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(screen.getByText('20.1/32.0GB')).toBeInTheDocument()
  })

  it('renders GPU bars when available', async () => {
    const { __emit } = await import('../lib/appEvents')

    renderWithI18n(<SystemStats />)

    act(() => {
      __emit('system:stats', {
        cpu_usage: 10,
        mem_usage: 50,
        mem_total_mb: 16384,
        mem_used_mb: 8192,
        gpu_available: true,
        gpus: [{
          index: 0,
          name: 'RTX 4090',
          usage: 78,
          mem_usage: 40,
          mem_total_mb: 24576,
          mem_used_mb: 9830,
          temperature: 65,
        }],
      })
    })

    expect(screen.getByText('GPU')).toBeInTheDocument()
    expect(screen.getByText('VRAM')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('65°C')).toBeInTheDocument()
  })

  it('does not render GPU section when unavailable', async () => {
    const { __emit } = await import('../lib/appEvents')

    renderWithI18n(<SystemStats />)

    act(() => {
      __emit('system:stats', {
        cpu_usage: 10,
        mem_usage: 50,
        mem_total_mb: 16384,
        mem_used_mb: 8192,
        gpu_available: false,
        gpus: [],
      })
    })

    expect(screen.queryByText('GPU')).not.toBeInTheDocument()
    expect(screen.queryByText('VRAM')).not.toBeInTheDocument()
  })

  it('clamps percentage to 0-100', async () => {
    const { __emit } = await import('../lib/appEvents')

    renderWithI18n(<SystemStats />)

    act(() => {
      __emit('system:stats', {
        cpu_usage: 150,
        mem_usage: -10,
        mem_total_mb: 0,
        mem_used_mb: 0,
        gpu_available: false,
        gpus: [],
      })
    })

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('does not show temperature when 0', async () => {
    const { __emit } = await import('../lib/appEvents')

    renderWithI18n(<SystemStats />)

    act(() => {
      __emit('system:stats', {
        cpu_usage: 10,
        mem_usage: 50,
        mem_total_mb: 16384,
        mem_used_mb: 8192,
        gpu_available: true,
        gpus: [{
          index: 0,
          name: 'GPU',
          usage: 50,
          mem_usage: 30,
          mem_total_mb: 8192,
          mem_used_mb: 2458,
          temperature: 0,
        }],
      })
    })

    expect(screen.queryByText(/°C/)).not.toBeInTheDocument()
  })
})
