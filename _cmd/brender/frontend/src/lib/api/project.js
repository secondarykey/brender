import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/main').then(m => m.ProjectService)

export const ProjectApi = {
  /** プロジェクト一覧を取得 */
  list: () =>
    isWails() ? svc().then(s => s.List())
              : serverCall('project', 'list'),

  /** プロジェクトを取得
   * @param {{ id: string }} args
   */
  get: ({ id }) =>
    isWails() ? svc().then(s => s.Get(id))
              : serverCall('project', 'get', { id }),

  /** プロジェクトを作成
   * @param {{ name: string }} args
   */
  create: ({ name }) =>
    isWails() ? svc().then(s => s.Create(name))
              : serverCall('project', 'create', { name }),

  /** プロジェクトを更新
   * @param {{ id: string, name: string }} args
   */
  update: ({ id, name }) =>
    isWails() ? svc().then(s => s.Update(id, name))
              : serverCall('project', 'update', { id, name }),

  /** プロジェクトを削除
   * @param {{ id: string }} args
   */
  delete: ({ id }) =>
    isWails() ? svc().then(s => s.Delete(id))
              : serverCall('project', 'delete', { id }),

  /** ファイルを追加
   * @param {{ projectID: string, path: string }} args
   */
  addFile: ({ projectID, path }) =>
    isWails() ? svc().then(s => s.AddFile(projectID, path))
              : serverCall('project', 'add_file', { project_id: projectID, path }),

  /** ファイル情報を取得
   * @param {{ fileID: number }} args
   */
  getFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.GetFile(fileID))
              : serverCall('project', 'get_file', { file_id: fileID }),

  /** ファイル情報を更新
   * @param {{ fileID: number, name: string, blenderInstallID: number, scene: string }} args
   */
  updateFile: ({ fileID, name, blenderInstallID, scene }) =>
    isWails() ? svc().then(s => s.UpdateFile(fileID, name, blenderInstallID, scene))
              : serverCall('project', 'update_file', { file_id: fileID, name, blender_install_id: blenderInstallID, scene }),

  /** ファイルをプロジェクトから除外（履歴は残す）
   * @param {{ fileID: number }} args
   */
  removeFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.RemoveFile(fileID))
              : serverCall('project', 'remove_file', { file_id: fileID }),

  /** ファイルを完全削除
   * @param {{ fileID: number }} args
   */
  deleteFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.DeleteFile(fileID))
              : serverCall('project', 'delete_file', { file_id: fileID }),
}
