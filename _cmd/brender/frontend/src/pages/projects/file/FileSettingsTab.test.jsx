import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../../../test/helpers'
import FileSettingsTab from './FileSettingsTab'
import { ProjectApi, BlenderApi } from '../../../lib/api'

// ファイル設定: サーバの値をフォームに出し、保存では「固定」も含めて全部送ること、
// 保存してあったシーンが .blend から無くなったら知らせて空にすることを守る。

vi.hoisted(() => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: k => { store.delete(k) },
  }
})

vi.mock('../../../lib/api/_client', () => ({ isWails: () => true }))

vi.mock('../../../lib/api', () => ({
  ProjectApi: {
    getFile:          vi.fn(),
    updateFile:       vi.fn(),
    getFileThumbnail: vi.fn().mockResolvedValue(null),
  },
  BlenderApi: {
    list:        vi.fn(),
    getToolData: vi.fn(),
  },
  TagApi: { getFileTags: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../../../lib/appEvents', () => ({ onAppEvent: () => () => {} }))

vi.mock('../../../lib/toast', () => {
  const message = { showError: () => {}, clearError: () => {}, error: '' }
  const toast   = { showToast: () => {} }
  return { useToast: () => toast, useMessage: () => message }
})

// 右側の部品と権限の欄はこのテストの対象外
vi.mock('../../../components/PermissionSection', () => ({ default: () => null }))
vi.mock('../../../components/FavoriteButton', () => ({ default: () => null }))
vi.mock('../../../components/TagInput', () => ({ default: () => null }))

const FILE = {
  id: 'f1', name: 'scene.blend', note: 'memo', path: '/data/scene.blend',
  blender_install_id: 2, blender_fixed: true,
  scene: 'Scene', scene_fixed: false,
  camera: 'Cam', camera_fixed: true,
  engine: 'CYCLES', engine_fixed: false,
}

const TOOL_DATA = {
  Scenes:  [{ Name: 'Scene', Active: true, Camera: 'Cam', Engine: 'CYCLES' }],
  Cameras: [{ Name: 'Cam', Scenes: ['Scene'] }],
  Engines: ['CYCLES'],
}

const renderTab = (props = {}) => renderWithI18n(
  <FileSettingsTab projectID="p1" fileID="f1" fileName="scene.blend" role="owner"
    favorite={false} onFavoriteChange={() => {}} onUpdated={() => {}} onDeleted={() => {}} {...props} />
)

describe('FileSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    BlenderApi.list.mockResolvedValue([{ id: 2, name: 'Blender 5.0', version: '5.0' }])
    BlenderApi.getToolData.mockResolvedValue(TOOL_DATA)
    ProjectApi.getFile.mockResolvedValue(FILE)
    ProjectApi.updateFile.mockResolvedValue(FILE)
  })

  it('保存では読み込んだ値と「固定」をそのまま送る', async () => {
    await renderTab()
    await screen.findByDisplayValue('Blender 5.0 (5.0)')
    await waitFor(() => expect(BlenderApi.getToolData).toHaveBeenCalledWith({ installID: 2, fileID: 'f1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(ProjectApi.updateFile).toHaveBeenCalledWith({
      fileID: 'f1', name: 'scene.blend', note: 'memo',
      blenderInstallID: 2, blenderFixed: true,
      scene: 'Scene', sceneFixed: false,
      camera: 'Cam', cameraFixed: true,
      engine: 'CYCLES', engineFixed: false,
    })
  })

  it('.blend に無くなったシーンを知らせ、空にして保存する', async () => {
    ProjectApi.getFile.mockResolvedValue({ ...FILE, scene: 'Gone' })
    await renderTab()
    expect(await screen.findByText('workspace.sceneMissing')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(ProjectApi.updateFile).toHaveBeenCalledWith(expect.objectContaining({ scene: '', camera: '' }))
  })

  it('runner は保存も削除もできない', async () => {
    await renderTab({ role: 'runner' })
    await screen.findByDisplayValue('Blender 5.0 (5.0)')
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('scene.blend')).toBeDisabled()
  })
})
