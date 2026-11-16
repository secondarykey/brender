import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithI18n } from '../../../test/helpers'
import WorkspaceSettingsForm from './WorkspaceSettingsForm'
import { BlenderApi } from '../../../lib/api'

// ワークスペースの設定フォーム: 保存してあった値が .blend から無くなったら知らせて空にすること、
// ファイルに対するロールでボタンが出し分けられることを守る。

vi.mock('../../../lib/api', () => ({
  BlenderApi: {
    list:        vi.fn(),
    getCPUCount: vi.fn(),
    getToolData: vi.fn(),
    getEngines:  vi.fn(),
  },
  CodesApi: {
    getImageFormats:      vi.fn().mockResolvedValue([]),
    getResolutionPresets: vi.fn().mockResolvedValue([]),
  },
  EnvironmentApi: { get: vi.fn().mockResolvedValue({}) },
  WorkspaceApi:   {},
  QueueApi:       {},
}))

vi.mock('../../../lib/toast', () => {
  const message = { showError: () => {}, clearError: () => {}, error: '' }
  const toast   = { showToast: () => {} }
  return { useToast: () => toast, useMessage: () => message }
})

const TOOL_DATA = {
  Scenes:  [{ Name: 'Scene', Active: true, Start: 1, End: 10, Engine: 'CYCLES', Camera: 'Cam' }],
  Cameras: [{ Name: 'Cam', Scenes: ['Scene'] }],
  Engines: ['CYCLES', 'BLENDER_EEVEE_NEXT'],
}

function detail(ws = {}) {
  return {
    workspace: { name: 'WS1', project_file_id: 'f1', start: 0, end: -1, scene: '', camera: '', engine: '', ...ws },
    project_files: [{ id: 'f1' }],
  }
}

function renderForm(props = {}) {
  return renderWithI18n(
    <WorkspaceSettingsForm
      projectID="p1" fileID="f1" workspaceID="w1"
      detail={detail()} role="owner" navigate={() => {}}
      onUpdated={() => {}} onCopied={() => {}} onDeleted={() => {}}
      {...props}
    />
  )
}

describe('WorkspaceSettingsForm', () => {
  beforeEach(() => {
    BlenderApi.list.mockResolvedValue([])
    BlenderApi.getCPUCount.mockResolvedValue(8)
    BlenderApi.getToolData.mockResolvedValue(TOOL_DATA)
  })

  it('ワークスペースの値をフォームに出す', async () => {
    await renderForm()
    expect(await screen.findByDisplayValue('WS1')).toBeInTheDocument()
  })

  it('.blend に無くなったシーンを知らせ、名前の変わったエンジンを置き換える', async () => {
    await renderForm({ detail: detail({ scene: 'Gone', engine: 'BLENDER_EEVEE' }) })
    expect(await screen.findByText('workspace.sceneMissing')).toBeInTheDocument()
    expect(screen.getByText('workspace.engineConverted')).toBeInTheDocument()
    // 置き換えたエンジンが選ばれ、無くなったシーンは未設定に戻る
    await waitFor(() => expect(screen.getByDisplayValue('BLENDER_EEVEE_NEXT')).toBeInTheDocument())
    expect(document.querySelector('details.form-collapsible').open).toBe(true)
  })

  it('owner は削除・Test・実行・保存ができる', async () => {
    await renderForm({ role: 'owner' })
    await screen.findByDisplayValue('WS1')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'workspace.testRender' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /common\.run/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('runner は実行だけできて、保存・削除はできない', async () => {
    await renderForm({ role: 'runner' })
    await screen.findByDisplayValue('WS1')
    expect(screen.getByRole('button', { name: /common\.run/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('WS1')).toBeDisabled()
  })

  it('viewer は何も操作できない', async () => {
    await renderForm({ role: 'viewer' })
    await screen.findByDisplayValue('WS1')
    expect(screen.queryByRole('button', { name: /common\.run/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
