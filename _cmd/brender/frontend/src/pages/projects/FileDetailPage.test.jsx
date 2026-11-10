import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../../test/helpers'
import FileDetailPage from './FileDetailPage'

// ファイル画面の骨格を守るテスト:
//   ワークスペースは単独のページを持たず、ファイル画面の中で「左の一覧から選ぶ → 右に開く」。
//   ファイルの見出しはワークスペースを開いていても出たままになる。

const WORKSPACES = [
  { id: 'w1', name: 'Preview',  engine: 'BLENDER_EEVEE', start: 0, end: -1 },
  { id: 'w2', name: 'Final 4K', engine: 'CYCLES',        start: 1, end: 250 },
]

// このテスト環境には localStorage が無い（並び順の保存と languages.jsx の初期化が触る）
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
  WorkspaceApi: {
    listByProject: vi.fn(),
    getThumbnail:  vi.fn().mockResolvedValue(null),
    get:           vi.fn(),
  },
  ProjectApi: {
    getFile:          vi.fn().mockResolvedValue({ id: 'f1', name: 'scene.blend', my_role: 'owner' }),
    get:              vi.fn().mockResolvedValue({ project: { name: 'Project A', work_dir_id: 1 } }),
    getFileThumbnail: vi.fn().mockResolvedValue(null),
  },
  WorkDirApi:  { list: vi.fn().mockResolvedValue([{ id: 1, status: 'active' }]) },
  FavoriteApi: { isFavorite: vi.fn().mockResolvedValue(false) },
  QueueApi:    { listJobsByProjectFilePaged: vi.fn().mockResolvedValue({ jobs: [], total: 0 }) },
  BlenderApi:  {},
  TagApi:      {},
}))

vi.mock('../../lib/appEvents', () => ({ onAppEvent: () => () => {} }))

vi.mock('../../lib/toast', () => {
  const message = { showError: () => {}, clearError: () => {}, error: '' }
  const toast   = { showToast: () => {} }
  return { useToast: () => toast, useMessage: () => message }
})

// 右側の中身（設定フォーム）は別物なので、どのワークスペースで開かれたかだけを見る
vi.mock('./WorkspacePanel', () => ({
  default: ({ workspaceID, fileName }) => (
    <div data-testid="ws-panel">{workspaceID}@{fileName}</div>
  ),
}))

async function renderPage(props = {}) {
  const { WorkspaceApi } = await import('../../lib/api')
  WorkspaceApi.listByProject.mockResolvedValue([{ file: { id: 'f1' }, workspaces: WORKSPACES }])
  const navigate = vi.fn()
  const view = await renderWithI18n(
    <FileDetailPage projectID="p1" projectName="Project A" fileID="f1" fileName="scene.blend" navigate={navigate} {...props} />
  )
  await screen.findByText('Preview')
  return { navigate, ...view }
}

beforeEach(() => { vi.clearAllMocks() })

describe('FileDetailPage', () => {
  it('ファイルの見出しを出し、指定が無ければ先頭のワークスペースを開く', async () => {
    const { container } = await renderPage()
    const header = container.querySelector('.entity-header.entity-file')
    expect(within(header).getByText('File')).toBeInTheDocument()
    expect(within(header).getByRole('heading', { name: 'scene.blend' })).toBeInTheDocument()
    expect(screen.getByTestId('ws-panel')).toHaveTextContent('w1@scene.blend')
    expect(container.querySelector('.ws-rail-item.selected')).toHaveTextContent('Preview')
  })

  it('指定されたワークスペースを開き、一覧の行を選択中にする', async () => {
    const { container } = await renderPage({ workspaceID: 'w2' })
    expect(screen.getByTestId('ws-panel')).toHaveTextContent('w2@scene.blend')
    const selected = container.querySelectorAll('.ws-rail-item.selected')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('Final 4K')
    expect(selected[0]).toHaveAttribute('aria-current', 'true')
  })

  it('一覧の行を選ぶと、同じファイル画面のままワークスペースだけ切り替える', async () => {
    const { navigate } = await renderPage()
    await userEvent.click(screen.getByText('Final 4K'))
    expect(navigate).toHaveBeenLastCalledWith('file', expect.objectContaining({
      projectID: 'p1', fileID: 'f1', fileName: 'scene.blend', workspaceID: 'w2',
    }))
  })

  it('パンくずはファイルで終わる（ワークスペースは階層を増やさない）', async () => {
    const { container } = await renderPage({ workspaceID: 'w2' })
    const crumb = container.querySelector('.breadcrumb')
    expect(within(crumb).getByText('scene.blend').tagName).toBe('SPAN')
    expect(within(crumb).queryByText('Final 4K')).not.toBeInTheDocument()
  })

  it('実行履歴タブへ切り替えても、ファイルの見出しは残る', async () => {
    const { container } = await renderPage()
    await userEvent.click(screen.getByRole('button', { name: /tabs.history|History/ }))
    expect(screen.queryByTestId('ws-panel')).not.toBeInTheDocument()
    expect(container.querySelector('.entity-header.entity-file')).toBeInTheDocument()
  })

  it('fileID が無いときはワークスペースからファイルを引く', async () => {
    const { WorkspaceApi } = await import('../../lib/api')
    WorkspaceApi.get.mockResolvedValue({
      workspace: { id: 'w2', project_file_id: 'f1' },
      project_files: [{ id: 'f1', name: 'scene.blend' }],
    })
    await renderPage({ fileID: undefined, fileName: undefined, workspaceID: 'w2' })
    await waitFor(() => expect(screen.getByTestId('ws-panel')).toHaveTextContent('w2@scene.blend'))
    expect(WorkspaceApi.get).toHaveBeenCalledWith({ projectID: 'p1', workspaceID: 'w2' })
  })
})
