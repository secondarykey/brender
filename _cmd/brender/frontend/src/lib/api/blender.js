import { isWails, serverCall } from './_client'

// Wails Service を動的インポートしてサーバビルド時の依存を回避
const svc = () => import('../../../bindings/changeme').then(m => m.BlenderService)

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
}
