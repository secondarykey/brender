import { isWails, serverCall } from './_client'

// Wails Service を動的インポートしてサーバビルド時の依存を回避
const svc = () => import('../../../bindings/main/services/blender')

export const BlenderApi = {
  /** Blender インストール一覧を取得 */
  list: () =>
    isWails() ? svc().then(s => s.List())
              : serverCall('blender', 'list'),

  /** Blender を登録
   * @param {{ path: string }} args
   */
  register: ({ path }) =>
    isWails() ? svc().then(s => s.Register(path))
              : serverCall('blender', 'register', { path }),

  /** Blender を削除
   * @param {{ id: number }} args
   */
  delete: ({ id }) =>
    isWails() ? svc().then(s => s.Delete(id))
              : serverCall('blender', 'delete', { id }),

  /** Blender を参照しているワークスペース・ファイル・プロジェクトを取得
   * @param {{ id: number }} args
   */
  references: ({ id }) =>
    isWails() ? svc().then(s => s.References(id))
              : serverCall('blender', 'references', { id }),

  /** Blender の並び順を更新
   * @param {{ ids: number[] }} args
   */
  reorder: ({ ids }) =>
    isWails() ? svc().then(s => s.Reorder(ids))
              : serverCall('blender', 'reorder', { ids }),

  /** レンダーエンジン一覧を取得
   * @param {{ installID: number }} args
   */
  getEngines: ({ installID }) =>
    isWails() ? svc().then(s => s.GetEngines(installID))
              : serverCall('blender', 'get_engines', { install_id: installID }),

  /** シーン一覧を取得
   * @param {{ installID: number, fileID: number }} args
   */
  getScenes: ({ installID, fileID }) =>
    isWails() ? svc().then(s => s.GetScenes(installID, fileID))
              : serverCall('blender', 'get_scenes', { install_id: installID, file_id: fileID }),

  /** カメラ一覧を取得
   * @param {{ installID: number, fileID: string }} args
   */
  getCameras: ({ installID, fileID }) =>
    isWails() ? svc().then(s => s.GetCameras(installID, fileID))
              : serverCall('blender', 'get_cameras', { install_id: installID, file_id: fileID }),

  /** Tool データ（シーン詳細・カメラ一覧）を一括取得
   * @param {{ installID: number, fileID: string }} args
   */
  getToolData: ({ installID, fileID }) =>
    isWails() ? svc().then(s => s.GetToolData(installID, fileID))
              : serverCall('blender', 'get_tool_data', { install_id: installID, file_id: fileID }),

  /** 起動時 Blender 検証の警告一覧を取得 */
  warnings: () =>
    isWails() ? svc().then(s => s.Warnings())
              : serverCall('blender', 'warnings'),

  /** 実行ファイルが存在しない Blender の ID 一覧を取得（軽量チェック） */
  checkPaths: () =>
    isWails() ? svc().then(s => s.CheckPaths())
              : serverCall('blender', 'check_paths'),

  /** システムの論理 CPU コア数を取得 */
  getCPUCount: () =>
    isWails() ? svc().then(s => s.GetCPUCount())
              : serverCall('blender', 'get_cpu_count'),

  /** Blender GUI でファイルを開く（非同期・ノンブロッキング）
   * @param {{ installID: number, filePath: string }} args
   */
  openFile: ({ installID, filePath }) =>
    isWails() ? svc().then(s => s.OpenFile(installID, filePath))
              : serverCall('blender', 'open_file', { install_id: installID, file_path: filePath }),
}
