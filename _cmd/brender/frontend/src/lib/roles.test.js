import { describe, it, expect } from 'vitest'
import { roleAtLeast } from './roles'

describe('roleAtLeast', () => {
  it('同じか強いロールなら true', () => {
    expect(roleAtLeast('runner', 'runner')).toBe(true)
    expect(roleAtLeast('owner', 'runner')).toBe(true)
    expect(roleAtLeast('workspace_creator', 'editor')).toBe(true)
  })

  it('弱いロールなら false', () => {
    expect(roleAtLeast('viewer', 'runner')).toBe(false)
    expect(roleAtLeast('runner', 'editor')).toBe(false)
    expect(roleAtLeast('editor', 'workspace_creator')).toBe(false)
    expect(roleAtLeast('workspace_creator', 'owner')).toBe(false)
  })

  it('知らないロールは何もできない', () => {
    expect(roleAtLeast('', 'viewer')).toBe(false)
    expect(roleAtLeast(undefined, 'runner')).toBe(false)
    expect(roleAtLeast('admin', 'runner')).toBe(false)
  })
})
