import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/project')

export const ProjectApi = {
  /** プロジェクト一覧を取得
   * @param {{ sort?: string }} args  sort: "display_order" | "created_at" | "processed_at"
   */
  list: ({ sort = '' } = {}) =>
    isWails() ? svc().then(s => s.List(sort))
              : serverCall('project', 'list', { sort }),

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
   * @param {{ fileID: number, name: string, blenderInstallID: number, scene: string, engine: string, engineFixed: boolean }} args
   */
  updateFile: ({ fileID, name, blenderInstallID, blenderFixed = false, scene, sceneFixed = false, camera = '', cameraFixed = false, engine = '', engineFixed = false }) =>
    isWails() ? svc().then(s => s.UpdateFile(fileID, name, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed))
              : serverCall('project', 'update_file', { file_id: fileID, name, blender_install_id: blenderInstallID, blender_fixed: blenderFixed, scene, scene_fixed: sceneFixed, camera, camera_fixed: cameraFixed, engine, engine_fixed: engineFixed }),

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
   * @param {{ fileID: number }} args
   */
  deleteFile: ({ fileID }) =>
    isWails() ? svc().then(s => s.DeleteFile(fileID))
              : serverCall('project', 'delete_file', { file_id: fileID }),

  /** ファイルのサムネイル画像を base64 データURIで取得
   * @param {{ projectID: string, fileID: number }} args
   */
  getFileThumbnail: ({ projectID, fileID }) =>
    isWails() ? svc().then(s => s.GetFileThumbnail(projectID, fileID))
              : serverCall('project', 'get_file_thumbnail', { project_id: projectID, file_id: fileID }),

  /** プロジェクトのサムネイル画像を base64 データURIで取得
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
}
