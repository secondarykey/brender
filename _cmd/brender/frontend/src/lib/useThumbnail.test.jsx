import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const listeners = []
vi.mock('./appEvents', () => ({
  onAppEvent: (name, cb) => {
    if (name !== 'queue:changed') return () => {}
    listeners.push(cb)
    return () => { listeners.splice(listeners.indexOf(cb), 1) }
  },
}))

import { useThumbnail } from './useThumbnail'

const emitQueueChanged = () => act(() => { listeners.slice().forEach(cb => cb(0)) })

describe('useThumbnail', () => {
  beforeEach(() => { listeners.length = 0 })

  it('まだ無い間はキューの変化で取り直し、取れたら取り直さない', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('')            // 登録直後: まだ無い
      .mockResolvedValueOnce('data:thumb')  // Test 出力が終わった
    const { result } = renderHook(() => useThumbnail(fetcher, ['p', 'f']))

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(result.current[0]).toBeNull()

    emitQueueChanged()
    await waitFor(() => expect(result.current[0]).toBe('data:thumb'))

    emitQueueChanged()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('fetcher が null を返すときは取得しない', () => {
    const { result } = renderHook(() => useThumbnail(() => null, ['p']))
    emitQueueChanged()
    expect(result.current[0]).toBeNull()
  })

  it('setSrc で差し替えた画像は取り直さない', async () => {
    const fetcher = vi.fn().mockResolvedValue('')
    const { result } = renderHook(() => useThumbnail(fetcher, ['p']))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    act(() => result.current[1]('data:uploaded'))
    emitQueueChanged()
    expect(result.current[0]).toBe('data:uploaded')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
