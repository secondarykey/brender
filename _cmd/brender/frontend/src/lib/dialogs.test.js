import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@wailsio/runtime', () => ({
  Dialogs: {
    OpenFile: vi.fn(),
    SaveFile: vi.fn(),
  },
}))

import { Dialogs } from '@wailsio/runtime'
import { openFile, openDirectory, saveFile, isDialogCancelled } from './dialogs'

// Windows で取り消したときに Wails が返すエラー
const cancelled = () => new Error('Dialog.OpenFile failed, error getting selection: cancelled by user')

describe('dialogs', () => {
  beforeEach(() => {
    Dialogs.OpenFile.mockReset()
    Dialogs.SaveFile.mockReset()
  })

  it('選んだパスをそのまま返す', async () => {
    Dialogs.OpenFile.mockResolvedValue('C:\\a.blend')
    Dialogs.SaveFile.mockResolvedValue('C:\\a.zip')
    await expect(openFile()).resolves.toBe('C:\\a.blend')
    await expect(openDirectory()).resolves.toBe('C:\\a.blend')
    await expect(saveFile()).resolves.toBe('C:\\a.zip')
  })

  it('取り消し（Windows の reject）は空文字にする', async () => {
    Dialogs.OpenFile.mockRejectedValue(cancelled())
    Dialogs.SaveFile.mockRejectedValue(cancelled())
    await expect(openFile()).resolves.toBe('')
    await expect(openDirectory()).resolves.toBe('')
    await expect(saveFile()).resolves.toBe('')
  })

  it('取り消し（macOS・Linux の空文字や null）も空文字にする', async () => {
    Dialogs.OpenFile.mockResolvedValue(null)
    Dialogs.SaveFile.mockResolvedValue('')
    await expect(openFile()).resolves.toBe('')
    await expect(saveFile()).resolves.toBe('')
  })

  it('ほかのエラーはそのまま投げる', async () => {
    const err = new Error('access denied')
    Dialogs.OpenFile.mockRejectedValue(err)
    Dialogs.SaveFile.mockRejectedValue(err)
    await expect(openFile()).rejects.toBe(err)
    await expect(openDirectory()).rejects.toBe(err)
    await expect(saveFile()).rejects.toBe(err)
  })

  it('openDirectory はフォルダだけを選ぶ設定で開く', async () => {
    Dialogs.OpenFile.mockResolvedValue('D:\\work')
    await openDirectory({ Title: 'x' })
    expect(Dialogs.OpenFile).toHaveBeenCalledWith(expect.objectContaining({
      Title: 'x', CanChooseDirectories: true, CanChooseFiles: false, AllowsMultipleSelection: false,
    }))
  })

  it('isDialogCancelled は文字列のエラーも見分ける', () => {
    expect(isDialogCancelled('cancelled by user')).toBe(true)
    expect(isDialogCancelled(new Error('other'))).toBe(false)
    expect(isDialogCancelled(null)).toBe(false)
  })
})
