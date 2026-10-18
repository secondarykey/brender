const svc = () => import('../../../bindings/main/services/workspace')

export const WorkspaceApi = {
  /** プロジェクト内のワークスペース一覧をファイルごとに取得
   * @param {{ projectID: string, sort?: string, dir?: string }} args
   */
  listByProject: ({ projectID, sort = '', dir = '' }) =>
    svc().then(s => s.ListByProject(projectID, sort, dir)),

  /** ワークスペースを取得
   * @param {{ projectID: string, workspaceID: string }} args
   */
  get: ({ projectID, workspaceID }) =>
    svc().then(s => s.Get(projectID, workspaceID)),

  /** ワークスペースを作成
   * @param {{ projectID: string, projectFileID: number, name: string }} args
   */
  create: ({ projectID, projectFileID, name }) =>
    svc().then(s => s.Create(projectID, projectFileID, name)),

  /** ワークスペースを更新
   * @param {{ projectID: string, workspaceID: string, name: string, note: string,
   *           blenderInstallID: number, scene: string, camera: string, engine: string,
   *           startFrame: number, endFrame: number, frameStep: number, thread: number, samples: number }} args
   */
  update: ({ projectID, workspaceID, name, note = '', blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat = '', autoLock = false, autoLockMinSize = 0, autoLockKeep = 1 }) =>
    svc().then(s => s.Update(projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat, autoLock, autoLockMinSize, autoLockKeep)),

  /** ワークスペースをコピーして新規作成
   * @param {{ projectID: string, workspaceID: string, newName: string }} args
   */
  copy: ({ projectID, workspaceID, newName }) =>
    svc().then(s => s.Copy(projectID, workspaceID, newName)),

  /** ワークスペースを削除
   * @param {{ projectID: string, workspaceID: string, force?: boolean }} args
   */
  delete: ({ projectID, workspaceID, force = false }) =>
    svc().then(s => s.Delete(projectID, workspaceID, force)),

  /** ワークスペースのサムネイルを取得。Wails は base64、サーバモードは配信URL。
   * @param {{ projectID: string, fileID: string, workspaceID: string }} args
   */
  getThumbnail: ({ projectID, fileID, workspaceID }) =>
    svc().then(s => s.GetThumbnail(projectID, fileID, workspaceID)),

  /** 画像ファイルをワークスペースサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, workspaceID: string, imagePath: string }} args
   */
  setThumbnail: ({ projectID, fileID, workspaceID, imagePath }) =>
    svc().then(s => s.SetThumbnail(projectID, fileID, workspaceID, imagePath)),

  /** ワークスペースを一括作成（エンジン・シーン・カメラの組み合わせ）
   * @param {{ projectID: string, projectFileID: string, specs: Array<{name:string, scene:string, camera:string, engine:string}> }} args
   */
  createBatch: ({ projectID, projectFileID, specs }) =>
    svc().then(s => s.CreateBatch(projectID, projectFileID, specs)),

  createMovie: ({ projectID, fileID, workspaceID, jobID, fps, outext, extraArgs }) =>
    svc().then(s => s.CreateMovie(projectID, fileID, workspaceID, jobID, fps, outext, extraArgs)),
}
