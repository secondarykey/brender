import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/project')

export const ProjectApi = {
  /** プロジェクト一覧を取得
   * @param {{ sort?: string, dir?: string }} args
   */
  list: ({ sort = '', dir = '' } = {}) =>
    isWails() ? svc().then(s => s.List(sort, dir))
              : serverCall('project', 'list', { sort, dir }),

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
   * @param {{ id: string, name: string, note: string }} args
   */
  update: ({ id, name, note = '' }) =>
    isWails() ? svc().then(s => s.Update(id, name, note))
              : serverCall('project', 'update', { id, name, note }),

  /** プロジェクトを削除
   * @param {{ id: string, force?: boolean }} args
   */
  delete: ({ id, force = false }) =>
    isWails() ? svc().then(s => s.Delete(id, force))
              : serverCall('project', 'delete', { id, force }),

  /** ファイルを追加
   * @param {{ projectID: string, path: string }} args
   */
  addFile: ({ projectID, path }) =>
    isWails() ? svc().then(s => s.AddFile(projectID, path))
              : serverCall('project', 'add_file', { project_id: projectID, path }),

  /** ファイルをアップロードして追加（サーバモード用）
   * @param {{ projectID: string, file: File, onProgress?: (pct: number) => void }} args
   */
  uploadFile: ({ projectID, file, onProgress }) => {
    return new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('project_id', projectID)
      form.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/project/upload_file')

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(e.loaded / e.total)
          }
        })
      }

      xhr.addEventListener('load', () => {
        try {
          const json = JSON.parse(xhr.responseText)
          if (json.error) reject(new Error(json.error))
          else resolve(json.data)
        } catch {
          reject(new Error('Invalid response'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.send(form)
    })
  },

  /** 全プロジェクトの全ファイルを取得（設定画面の一括確認用）
   */
  listAllFiles: () =>
    isWails() ? svc().then(s => s.ListAllFiles())
              : serverCall('project', 'list_all_files'),

  /** ファイル情報を取得
   * @param {{ fileID: number }} args
   */
  getFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.GetFile(fileID))
              : serverCall('project', 'get_file', { file_id: fileID }),

  /** ファイル情報を更新
   * @param {{ fileID: number, name: string, note: string, blenderInstallID: number, scene: string, engine: string, engineFixed: boolean }} args
   */
  updateFile: ({ fileID, name, note = '', blenderInstallID, blenderFixed = false, scene, sceneFixed = false, camera = '', cameraFixed = false, engine = '', engineFixed = false }) =>
    isWails() ? svc().then(s => s.UpdateFile(fileID, name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed))
              : serverCall('project', 'update_file', { file_id: fileID, name, note, blender_install_id: blenderInstallID, blender_fixed: blenderFixed, scene, scene_fixed: sceneFixed, camera, camera_fixed: cameraFixed, engine, engine_fixed: engineFixed }),

  /** ディレクトリ内の .blend ファイルを一括追加
   * @param {{ projectID: string, dir: string }} args
   */
  addFilesFromDir: ({ projectID, dir }) =>
    isWails() ? svc().then(s => s.AddFilesFromDir(projectID, dir))
              : serverCall('project', 'add_files_from_dir', { project_id: projectID, dir }),

  /** ファイルをプロジェクトから除外（履歴は残す）
   * @param {{ fileID: number }} args
   */
  removeFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.RemoveFile(fileID))
              : serverCall('project', 'remove_file', { file_id: fileID }),

  /** ファイルを完全削除
   * @param {{ fileID: string, force?: boolean }} args
   */
  deleteFile: ({ fileID, force = false }) =>
    isWails() ? svc().then(s => s.DeleteFile(fileID, force))
              : serverCall('project', 'delete_file', { file_id: fileID, force }),

  /** ファイルのサムネイルを取得。Wails は base64 データURI、サーバモードは
   * 配信URL（/thumbnail?...、ブラウザキャッシュが効く）。存在しなければ空文字。
   * どちらも文字列なので img の src にそのまま渡せる。
   * @param {{ projectID: string, fileID: number }} args
   */
  getFileThumbnail: ({ projectID, fileID }) =>
    isWails() ? svc().then(s => s.GetFileThumbnail(projectID, fileID))
              : serverCall('project', 'get_file_thumbnail', { project_id: projectID, file_id: fileID }),

  /** プロジェクトのサムネイルを取得。Wails は base64、サーバモードは配信URL。
   * @param {{ projectID: string }} args
   */
  getProjectThumbnail: ({ projectID }) =>
    isWails() ? svc().then(s => s.GetProjectThumbnail(projectID))
              : serverCall('project', 'get_project_thumbnail', { project_id: projectID }),

  /** 画像ファイルをプロジェクトサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, imagePath: string }} args
   */
  setProjectThumbnail: ({ projectID, imagePath }) =>
    isWails() ? svc().then(s => s.SetProjectThumbnail(projectID, imagePath))
              : serverCall('project', 'set_project_thumbnail', { project_id: projectID, image_path: imagePath }),

  /** 画像ファイルをファイルサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, imagePath: string }} args
   */
  setFileThumbnail: ({ projectID, fileID, imagePath }) =>
    isWails() ? svc().then(s => s.SetFileThumbnail(projectID, fileID, imagePath))
              : serverCall('project', 'set_file_thumbnail', { project_id: projectID, file_id: fileID, image_path: imagePath }),

  /** ワークスペースのサムネイルをファイルサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, workspaceID: string }} args
   */
  setFileThumbnailFromWorkspace: ({ projectID, fileID, workspaceID }) =>
    isWails() ? svc().then(s => s.SetFileThumbnailFromWorkspace(projectID, fileID, workspaceID))
              : serverCall('project', 'set_file_thumbnail_from_workspace', { project_id: projectID, file_id: fileID, workspace_id: workspaceID }),

  /** ファイルのサムネイルをプロジェクトサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string }} args
   */
  setProjectThumbnailFromFile: ({ projectID, fileID }) =>
    isWails() ? svc().then(s => s.SetProjectThumbnailFromFile(projectID, fileID))
              : serverCall('project', 'set_project_thumbnail_from_file', { project_id: projectID, file_id: fileID }),

  // ── Permission ────────────────────────────────────────

  /** プロジェクト権限を設定
   * @param {{ projectID: string, targetID: string, role: string }} args
   */
  setPermission: ({ projectID, targetID, role }) =>
    isWails() ? svc().then(s => s.SetPermission(projectID, targetID, role))
              : serverCall('project', 'set_permission', { project_id: projectID, target_id: targetID, role }),

  /** プロジェクト権限を削除
   * @param {{ projectID: string, targetID: string }} args
   */
  removePermission: ({ projectID, targetID }) =>
    isWails() ? svc().then(s => s.RemovePermission(projectID, targetID))
              : serverCall('project', 'remove_permission', { project_id: projectID, target_id: targetID }),

  /** プロジェクトの権限一覧を取得
   * @param {{ projectID: string }} args
   */
  listPermissions: ({ projectID }) =>
    isWails() ? svc().then(s => s.ListPermissions(projectID))
              : serverCall('project', 'list_permissions', { project_id: projectID }),

  /** ユーザのプロジェクトでの最上位ロールを取得
   * @param {{ projectID: string, userID: string }} args
   */
  getUserRole: ({ projectID, userID }) =>
    isWails() ? svc().then(s => s.GetUserRole(projectID, userID))
              : serverCall('project', 'get_user_role', { project_id: projectID, user_id: userID }),

  // ── File Permission ───────────────────────────────────

  /** ファイル権限を設定
   * @param {{ fileID: string, targetID: string, role: string }} args
   */
  setFilePermission: ({ fileID, targetID, role }) =>
    isWails() ? svc().then(s => s.SetFilePermission(fileID, targetID, role))
              : serverCall('project', 'set_file_permission', { file_id: fileID, target_id: targetID, role }),

  /** ファイル権限を削除
   * @param {{ fileID: string, targetID: string }} args
   */
  removeFilePermission: ({ fileID, targetID }) =>
    isWails() ? svc().then(s => s.RemoveFilePermission(fileID, targetID))
              : serverCall('project', 'remove_file_permission', { file_id: fileID, target_id: targetID }),

  /** ファイルの権限一覧を取得
   * @param {{ fileID: string }} args
   */
  listFilePermissions: ({ fileID }) =>
    isWails() ? svc().then(s => s.ListFilePermissions(fileID))
              : serverCall('project', 'list_file_permissions', { file_id: fileID }),

  /** ユーザのファイルでの最上位ロールを取得
   * @param {{ fileID: string, userID: string }} args
   */
  getUserFileRole: ({ fileID, userID }) =>
    isWails() ? svc().then(s => s.GetUserFileRole(fileID, userID))
              : serverCall('project', 'get_user_file_role', { file_id: fileID, user_id: userID }),
}
