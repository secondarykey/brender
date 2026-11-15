import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderWithI18n } from '../../test/helpers'
import { RenderResultTab } from './JobPage'
import { QueueApi, EnvironmentApi } from '../../lib/api'

// 実行結果の「再生」が FPS に合わせてフレームを進めることを守るテスト:
//   1 フレーム分（1000 / fps ms。frame_step が 2 以上ならその倍）経つまで次のフレームを出さない。

vi.hoisted(() => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: k => { store.delete(k) },
  }
})

vi.mock('../../lib/api/_client', () => ({ isWails: () => true }))

vi.mock('../../lib/api', () => ({
  QueueApi: {
    listJobImages:  vi.fn(),
    listJobFiles:   vi.fn(),
    getImageBase64: vi.fn(),
  },
  EnvironmentApi: { get: vi.fn() },
  WorkspaceApi:   {},
  ProjectApi:     {},
  CodesApi:       {},
}))

vi.mock('../../lib/appEvents', () => ({ onAppEvent: () => () => {} }))

vi.mock('../../lib/toast', () => {
  const message = { showError: () => {}, clearError: () => {}, error: '' }
  const toast   = { showToast: () => {} }
  return { useToast: () => toast, useMessage: () => message }
})

const IMAGES = ['/out/frame_0001.png', '/out/frame_0002.png', '/out/frame_0003.png']

const shown = () => screen.getByRole('img').getAttribute('alt')
const advance = ms => act(() => vi.advanceTimersByTimeAsync(ms))

async function renderTab(job, loadMs = 0) {
  await renderWithI18n(<RenderResultTab job={{ id: 'j1', data_status: 2, ...job }} role="viewer" />)
  await advance(loadMs)
  expect(shown()).toBe('frame_0001.png')
}

describe('RenderResultTab の再生', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    QueueApi.listJobImages.mockResolvedValue(IMAGES)
    QueueApi.listJobFiles.mockResolvedValue([])
    QueueApi.getImageBase64.mockImplementation(({ path }) => Promise.resolve(`data:${path}`))
    EnvironmentApi.get.mockResolvedValue({ ffmpeg_fps: 0 })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('ジョブの FPS の間隔で進み、最後で止まる', async () => {
    await renderTab({ fps: 10, frame_step: 1 })
    fireEvent.click(screen.getByTitle('10 fps'))

    await advance(90)
    expect(shown()).toBe('frame_0001.png')
    await advance(10)
    expect(shown()).toBe('frame_0002.png')
    await advance(99)
    expect(shown()).toBe('frame_0002.png')
    await advance(1)
    expect(shown()).toBe('frame_0003.png')

    // ループしないので最後で止まる
    await advance(500)
    expect(shown()).toBe('frame_0003.png')
    expect(screen.getByRole('slider')).toHaveValue('2')
  })

  it('frame_step が 2 なら 1 枚を 2 フレーム分出す', async () => {
    await renderTab({ fps: 10, frame_step: 2 })
    fireEvent.click(screen.getByTitle('10 fps'))

    await advance(190)
    expect(shown()).toBe('frame_0001.png')
    await advance(10)
    expect(shown()).toBe('frame_0002.png')
  })

  it('ジョブに FPS が無ければ設定の FPS を使う', async () => {
    EnvironmentApi.get.mockResolvedValue({ ffmpeg_fps: 5 })
    await renderTab({ fps: 0 })
    fireEvent.click(screen.getByTitle('5 fps'))

    await advance(190)
    expect(shown()).toBe('frame_0001.png')
    await advance(10)
    expect(shown()).toBe('frame_0002.png')
  })

  it('読み込みが遅くても、読み込みと表示の待ちを足さない', async () => {
    // 1 枚の読み込みに 60ms かかる。前のフレームを出してから 100ms で次が出る（160ms ではない）
    QueueApi.getImageBase64.mockImplementation(({ path }) =>
      new Promise(r => setTimeout(() => r(`data:${path}`), 60)))
    await renderTab({ fps: 10 }, 60)

    fireEvent.click(screen.getByTitle('10 fps'))
    await advance(99)
    expect(shown()).toBe('frame_0001.png')
    await advance(1)
    expect(shown()).toBe('frame_0002.png')
    await advance(100)
    expect(shown()).toBe('frame_0003.png')
  })
})
