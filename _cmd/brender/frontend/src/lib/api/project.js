const svc = () => import('../../../bindings/main/services/project')

export const ProjectApi = {
  /** プロジェクト一覧を取得
   * @param {{ sort?: string, dir?: string }} args
   */
  list: ({ sort = '', dir = '' } = {}) =>
    svc().then(s => s.List(sort, dir)),

  /** プロジェクトを取得
   * @param {{ id: string }} args
   */
  get: ({ id }) =>
    svc().then(s => s.Get(id)),

  /** プロジェクトを作成
   * @param {{ name: string }} args
   */
  create: ({ name }) =>
    svc().then(s => s.Create(name)),

  /** プロジェクトを更新
   * @param {{ id: string, name: string, note: string }} args
   */
  update: ({ id, name, note = '' }) =>
    svc().then(s => s.Update(id, name, note)),

  /** プロジェクトを削除
   * @param {{ id: string, force?: boolean }} args
   */
  delete: ({ id, force = false }) =>
    svc().then(s => s.Delete(id, force)),

  /** ファイルを追加
   * @param {{ projectID: string, path: string }} args
   */
  addFile: ({ projectID, path }) =>
    svc().then(s => s.AddFile(projectID, path)),

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
    svc().then(s => s.ListAllFiles()),

  /** ファイル情報を取得
   * @param {{ fileID: number }} args
   */
  getFile: ({ fileID }) =>
    svc().then(s => s.GetFile(fileID)),

  /** ファイル情報を更新
   * @param {{ fileID: number, name: string, note: string, blenderInstallID: number, scene: string, engine: string, engineFixed: boolean }} args
   */
  updateFile: ({ fileID, name, note = '', blenderInstallID, blenderFixed = false, scene, sceneFixed = false, camera = '', cameraFixed = false, engine = '', engineFixed = false }) =>
    svc().then(s => s.UpdateFile(fileID, name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed)),

  /** ディレクトリ内の .blend ファイルを一括追加
   * @param {{ projectID: string, dir: string }} args
   */
  addFilesFromDir: ({ projectID, dir }) =>
    svc().then(s => s.AddFilesFromDir(projectID, dir)),

  /** ファイルをプロジェクトから除外（履歴は残す）
   * @param {{ fileID: number }} args
   */
  removeFile: ({ fileID }) =>
    svc().then(s => s.RemoveFile(fileID)),

  /** ファイルを完全削除
   * @param {{ fileID: string, force?: boolean }} args
   */
  deleteFile: ({ fileID, force = false }) =>
    svc().then(s => s.DeleteFile(fileID, force)),

  /** ファイルのサムネイルを取得。Wails は base64 データURI、サーバモードは
   * 配信URL（/thumbnail?...、ブラウザキャッシュが効く）。存在しなければ空文字。
   * どちらも文字列なので img の src にそのまま渡せる。
   * @param {{ projectID: string, fileID: number }} args
   */
  getFileThumbnail: ({ projectID, fileID }) =>
    svc().then(s => s.GetFileThumbnail(projectID, fileID)),

  /** プロジェクトのサムネイルを取得。Wails は base64、サーバモードは配信URL。
   * @param {{ projectID: string }} args
   */
  getProjectThumbnail: ({ projectID }) =>
    svc().then(s => s.GetProjectThumbnail(projectID)),

  /** 画像ファイルをプロジェクトサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, imagePath: string }} args
   */
  setProjectThumbnail: ({ projectID, imagePath }) =>
    svc().then(s => s.SetProjectThumbnail(projectID, imagePath)),

  /** 画像ファイルをファイルサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, imagePath: string }} args
   */
  setFileThumbnail: ({ projectID, fileID, imagePath }) =>
    svc().then(s => s.SetFileThumbnail(projectID, fileID, imagePath)),

  /** ワークスペースのサムネイルをファイルサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, workspaceID: string }} args
   */
  setFileThumbnailFromWorkspace: ({ projectID, fileID, workspaceID }) =>
    svc().then(s => s.SetFileThumbnailFromWorkspace(projectID, fileID, workspaceID)),

  /** ファイルのサムネイルをプロジェクトサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string }} args
   */
  setProjectThumbnailFromFile: ({ projectID, fileID }) =>
    svc().then(s => s.SetProjectThumbnailFromFile(projectID, fileID)),

  // ── Permission ────────────────────────────────────────

  /** プロジェクト権限を設定
   * @param {{ projectID: string, targetID: string, role: string }} args
   */
  setPermission: ({ projectID, targetID, role }) =>
    svc().then(s => s.SetPermission(projectID, targetID, role)),

  /** プロジェクト権限を削除
   * @param {{ projectID: string, targetID: string }} args
   */
  removePermission: ({ projectID, targetID }) =>
    svc().then(s => s.RemovePermission(projectID, targetID)),

  /** プロジェクトの権限一覧を取得
   * @param {{ projectID: string }} args
   */
  listPermissions: ({ projectID }) =>
    svc().then(s => s.ListPermissions(projectID)),

  /** ユーザのプロジェクトでの最上位ロールを取得
   * @param {{ projectID: string, userID: string }} args
   */
  getUserRole: ({ projectID, userID }) =>
    svc().then(s => s.GetUserRole(projectID, userID)),

  // ── File Permission ───────────────────────────────────

  /** ファイル権限を設定
   * @param {{ fileID: string, targetID: string, role: string }} args
   */
  setFilePermission: ({ fileID, targetID, role }) =>
    svc().then(s => s.SetFilePermission(fileID, targetID, role)),

  /** ファイル権限を削除
   * @param {{ fileID: string, targetID: string }} args
   */
  removeFilePermission: ({ fileID, targetID }) =>
    svc().then(s => s.RemoveFilePermission(fileID, targetID)),

  /** ファイルの権限一覧を取得
   * @param {{ fileID: string }} args
   */
  listFilePermissions: ({ fileID }) =>
    svc().then(s => s.ListFilePermissions(fileID)),

  /** ユーザのファイルでの最上位ロールを取得
   * @param {{ fileID: string, userID: string }} args
   */
  getUserFileRole: ({ fileID, userID }) =>
    svc().then(s => s.GetUserFileRole(fileID, userID)),
}
