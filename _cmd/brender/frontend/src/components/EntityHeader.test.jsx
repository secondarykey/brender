import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithI18n } from '../test/helpers'
import EntityHeader from './EntityHeader'

// 見出し帯は「いま見ているものの種別」を言葉で出す。アイコンと色だけに戻すと落ちる。
describe('EntityHeader', () => {
  it.each([
    ['project',   'Project'],
    ['file',      'File'],
    ['workspace', 'Workspace'],
  ])('%s: 種別ラベルと名称を出す', async (type, label) => {
    const { container } = await renderWithI18n(<EntityHeader type={type} name="My Name" />)
    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'My Name' })).toBeInTheDocument()
    expect(container.querySelector(`.entity-header.entity-${type}`)).toBeInTheDocument()
    expect(container.querySelector(`.entity-icon.entity-${type}`)).toBeInTheDocument()
  })

  it('サムネイル・名称の右のマーク・操作を差し込める', async () => {
    await renderWithI18n(
      <EntityHeader
        type="workspace"
        name="WS"
        thumb={<span data-testid="thumb" />}
        suffix={<span data-testid="mark">!</span>}
      >
        <button>Run</button>
      </EntityHeader>
    )
    expect(screen.getByTestId('thumb')).toBeInTheDocument()
    expect(screen.getByTestId('mark')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
  })
})
