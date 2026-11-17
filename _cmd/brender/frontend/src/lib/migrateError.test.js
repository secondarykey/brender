import { describe, it, expect } from 'vitest'
import { migrateErrorMessage } from './migrateError'

const t = (key) => ({ 'project.migrateError': '移行中にエラーが発生しました' })[key]

describe('migrateErrorMessage', () => {
  it('サーバから理由が来たら後ろに付ける', () => {
    expect(migrateErrorMessage(t, 'copy D:\work\p: denied'))
      .toBe('移行中にエラーが発生しました: copy D:\work\p: denied')
  })
  it('理由が無ければ決まった文言だけ', () => {
    expect(migrateErrorMessage(t, '')).toBe('移行中にエラーが発生しました')
    expect(migrateErrorMessage(t, undefined)).toBe('移行中にエラーが発生しました')
  })
})
