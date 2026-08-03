import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import HierarchyBreadcrumb from './HierarchyBreadcrumb'

// 階層ごとの表現がページ間でずれないことを保証するテスト。
// パンくずをページ側で手書きに戻すと（= 階層が増えてもアイコンが付かない等）ここが落ちる。

const FULL = {
  projectID:     'p1',
  projectName:   'Project A',
  fileID:        'f1',
  fileName:      'scene.blend',
  workspaceID:   'w1',
  workspaceName: 'WS 1',
}

// 各階層に entity-{type} クラスのアイコンが1つずつ出ていることを確認する
function iconTypes(container) {
  return [...container.querySelectorAll('.entity-icon')]
    .map(el => [...el.classList].find(c => c.startsWith('entity-') && c !== 'entity-icon'))
}

describe('HierarchyBreadcrumb', () => {
  it('プロジェクト詳細: プロジェクトまでの階層を出す', async () => {
    const { container } = await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} projectID="p1" projectName="Project A" />
    )
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Project A')).toBeInTheDocument()
    expect(iconTypes(container)).toEqual(['entity-project'])
  })

  it('ファイル詳細: ファイルまでの階層を出す', async () => {
    const { container } = await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} {...FULL} workspaceID={undefined} workspaceName={undefined} />
    )
    expect(iconTypes(container)).toEqual(['entity-project', 'entity-file'])
  })

  it('ワークスペース詳細: ワークスペースまでの階層を出す', async () => {
    const { container } = await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} {...FULL} />
    )
    expect(iconTypes(container)).toEqual(['entity-project', 'entity-file', 'entity-workspace'])
  })

  it('実行結果: 全階層にアイコンが出る（実行結果を含む）', async () => {
    const { container } = await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} {...FULL} job />
    )
    expect(screen.getByText('Job Result')).toBeInTheDocument()
    expect(iconTypes(container)).toEqual(['entity-project', 'entity-file', 'entity-workspace', 'entity-job'])
  })

  it('最下層は現在地なのでリンクにしない', async () => {
    await renderWithI18n(<HierarchyBreadcrumb navigate={vi.fn()} {...FULL} />)
    expect(screen.getByText('Projects').tagName).toBe('BUTTON')
    expect(screen.getByText('Project A').tagName).toBe('BUTTON')
    expect(screen.getByText('scene.blend').tagName).toBe('BUTTON')
    expect(screen.getByText('WS 1').tagName).toBe('SPAN')
  })

  it('実行結果ページではワークスペースまでリンクになる', async () => {
    await renderWithI18n(<HierarchyBreadcrumb navigate={vi.fn()} {...FULL} job />)
    expect(screen.getByText('WS 1').tagName).toBe('BUTTON')
    expect(screen.getByText('Job Result').tagName).toBe('SPAN')
  })

  it('上位階層のリンク先が階層ごとに一意に決まる', async () => {
    const navigate = vi.fn()
    await renderWithI18n(<HierarchyBreadcrumb navigate={navigate} {...FULL} job />)

    await userEvent.click(screen.getByText('Projects'))
    expect(navigate).toHaveBeenLastCalledWith('projects')

    await userEvent.click(screen.getByText('Project A'))
    expect(navigate).toHaveBeenLastCalledWith('project', { id: 'p1', initialTab: 'settings' })

    await userEvent.click(screen.getByText('scene.blend'))
    expect(navigate).toHaveBeenLastCalledWith('file', expect.objectContaining({
      projectID: 'p1', fileID: 'f1', initialTab: 'settings',
    }))

    await userEvent.click(screen.getByText('WS 1'))
    expect(navigate).toHaveBeenLastCalledWith('workspace', expect.objectContaining({
      projectID: 'p1', fileID: 'f1', workspaceID: 'w1',
    }))
  })

  it('ファイル名が未解決のうちはファイル階層を出さない', async () => {
    const { container } = await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} {...FULL} fileName={undefined} />
    )
    expect(iconTypes(container)).toEqual(['entity-project', 'entity-workspace'])
  })

  it('suffix を指定した階層に差し込める', async () => {
    await renderWithI18n(
      <HierarchyBreadcrumb navigate={vi.fn()} {...FULL} suffix={{ workspace: <span data-testid="stale">!</span> }} />
    )
    expect(screen.getByTestId('stale')).toBeInTheDocument()
  })
})
