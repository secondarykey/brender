import { describe, it, expect } from 'vitest'
import { isVideoFile, isImageFile, isJobLocked, hasJobData, formatBytes, jobDuration } from './jobFiles'

const t = k => ({ 'time.seconds': 's', 'time.minutes': 'm', 'time.hours': 'h' })[k]

describe('jobFiles', () => {
  it('拡張子でファイルの種類を見分ける（大文字も）', () => {
    expect(isVideoFile('out.MP4')).toBe(true)
    expect(isVideoFile('frame_0001.png')).toBe(false)
    expect(isImageFile('frame_0001.EXR')).toBe(true)
    expect(isImageFile('render.log')).toBe(false)
    expect(isImageFile('noext')).toBe(false)
  })

  it('データの状態は奇数がロック付き', () => {
    expect(isJobLocked(3)).toBe(true)
    expect(isJobLocked(2)).toBe(false)
  })

  it('出力が残っている状態だけ見られる', () => {
    for (const s of [2, 3, 6, 7, 8, 9]) expect(hasJobData(s)).toBe(true)
    for (const s of [0, 1, 4, 5]) expect(hasJobData(s)).toBe(false)
  })

  it('容量を 1024 ごとの単位で出す', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })

  it('かかった時間を秒・分・時間で出す', () => {
    const at = sec => new Date(Date.UTC(2026, 0, 1, 0, 0, sec)).toISOString()
    expect(jobDuration(at(0), at(42), t)).toBe('42s')
    expect(jobDuration(at(0), at(125), t)).toBe('2m5s')
    expect(jobDuration(at(0), at(3725), t)).toBe('1h2m')
    expect(jobDuration(null, at(1), t)).toBe('—')
  })
})
