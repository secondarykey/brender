import { isWails } from './_client'

const svc = () => import('../../../bindings/main/services/queue')

export const QueueApi = {
  /** レンダリング前パラメータをプレビュー解決
   * @param {{ projectID: string, workspaceID: string }} args
   */
  previewRender: ({ projectID, workspaceID }) =>
    svc().then(s => s.PreviewRender(projectID, workspaceID)),

  /** プレビュー済みパラメータでキューに追加
   * @param {{ projectID: string, workspaceID: string, preview: object }} args
   */
  enqueueWithPreview: ({ projectID, workspaceID, preview }) =>
    svc().then(s => s.EnqueueWithPreview(projectID, workspaceID, preview)),

  /** テストレンダリング（サンプル8・中間1フレーム）をキューに追加
   * @param {{ projectID: string, workspaceID: string, params: object }} args
   */
  testEnqueue: ({ projectID, workspaceID, params }) =>
    svc().then(s => s.TestEnqueue(projectID, workspaceID, params)),

  /** サンプル比較レンダリングをキューに追加
   * @param {{ projectID: string, workspaceID: string, sampleCounts: number[], frame: number }} args
   */
  samplesComparisonEnqueue: ({ projectID, workspaceID, sampleCounts, frame }) =>
    svc().then(s => s.SamplesComparisonEnqueue(projectID, workspaceID, sampleCounts, frame)),

  /** 実行中キュー一覧を取得 */
  list: () =>
    svc().then(s => s.List()),

  /** 実行中キューをライブ進捗付きで取得 */
  listItems: () =>
    svc().then(s => s.ListItems()),

  /** キューをキャンセル
   * @param {{ id: string }} args
   */
  cancel: ({ id }) =>
    svc().then(s => s.Cancel(id)),

  killRunning: () =>
    svc().then(s => s.KillRunning()),

  /** ジョブ履歴一覧を取得 */
  listJobs: () =>
    svc().then(s => s.ListJobs()),

  /** ジョブ履歴をページング付きで取得
   * @param {{ filter: { data_statuses?: number[], days?: number, sort_by?: string }, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number, total_size: number }>}
   */
  listJobsPaged: ({ filter, page, pageSize }) =>
    svc().then(s => s.ListJobsPaged(filter, page, pageSize)),

  /** ワークスペース別ジョブ履歴を取得
   * @param {{ projectID: string, workspaceID: string }} args
   */
  listJobsByWorkspace: ({ projectID, workspaceID }) =>
    svc().then(s => s.ListJobsByWorkspace(projectID, workspaceID)),

  /** ワークスペース別ジョブ履歴をページング付きで取得
   * @param {{ projectID: string, workspaceID: string, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number }>}
   */
  listJobsByWorkspacePaged: ({ projectID, workspaceID, page, pageSize }) =>
    svc().then(s => s.ListJobsByWorkspacePaged(projectID, workspaceID, page, pageSize)),

  /** ファイル別ジョブ履歴を取得
   * @param {{ projectID: string, fileID: number }} args
   */
  listJobsByProjectFile: ({ projectID, fileID }) =>
    svc().then(s => s.ListJobsByProjectFile(projectID, fileID)),

  /** ファイル別ジョブ履歴をページング付きで取得
   * @param {{ projectID: string, fileID: string, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number }>}
   */
  listJobsByProjectFilePaged: ({ projectID, fileID, page, pageSize }) =>
    svc().then(s => s.ListJobsByProjectFilePaged(projectID, fileID, page, pageSize)),

  /** ジョブ単体を取得
   * @param {{ id: string }} args
   */
  getJob: ({ id }) =>
    svc().then(s => s.GetJob(id)),

  /** ジョブの名称とノートを更新
   * @param {{ id: string, name: string, note: string }} args
   */
  updateJobMeta: ({ id, name, note }) =>
    svc().then(s => s.UpdateJobMeta(id, name, note)),

  /** ジョブを削除
   * @param {{ id: string }} args
   */
  deleteJob: ({ id }) =>
    svc().then(s => s.DeleteJob(id)),

  /** 出力データのみ削除（ジョブ履歴は残す）
   * @param {{ id: string }} args
   */
  deleteJobData: ({ id }) =>
    svc().then(s => s.DeleteJobData(id)),

  /** ジョブの出力ディレクトリにある画像パス一覧を取得
   * @param {{ id: string }} args
   */
  listJobImages: ({ id }) =>
    svc().then(s => s.ListJobImages(id)),

  /** ジョブの出力ディレクトリにある全ファイル情報を取得
   * @param {{ id: string }} args
   */
  listJobFiles: ({ id }) =>
    svc().then(s => s.ListJobFiles(id)),

  /** 画像ファイルを base64 データ URI として取得
   * @param {{ path: string }} args
   */
  getImageBase64: ({ path }) =>
    svc().then(s => s.GetImageBase64(path)),

  /** ジョブをロック
   * @param {{ id: string }} args
   */
  lockJob: ({ id }) =>
    svc().then(s => s.LockJob(id)),

  /** ジョブのロックを解除
   * @param {{ id: string }} args
   */
  unlockJob: ({ id }) =>
    svc().then(s => s.UnlockJob(id)),

  /** render.log の内容を取得
   * @param {{ id: string }} args
   */
  getJobLog: ({ id }) =>
    svc().then(s => s.GetJobLog(id)),

  /** render.log を別ウィンドウで開く
   * @param {{ id: string }} args
   */
  openLogWindow: ({ id }) =>
    isWails() ? svc().then(s => s.OpenLogWindow(id))
              : Promise.resolve(window.open(`?log=${encodeURIComponent(id)}`, '_blank')),

  /** 動画ファイルを別ウィンドウで再生
   * @param {{ path: string }} args
   */
  openMovieWindow: ({ path }) =>
    isWails() ? svc().then(s => s.OpenMovieWindow(path))
              : Promise.resolve(window.open(`?movie=${encodeURIComponent(path)}`, '_blank')),

  /** 出力ディレクトリ全体を ZIP 圧縮して指定パスに保存
   * @param {{ id: string, savePath: string }} args
   */
  zipJobData: ({ id, savePath }) =>
    svc().then(s => s.ZipJobData(id, savePath)),

  /** 選択ファイルを ZIP 圧縮して指定パスに保存
   * @param {{ id: string, filePaths: string[], savePath: string }} args
   */
  zipJobSelectedFiles: ({ id, filePaths, savePath }) =>
    svc().then(s => s.ZipJobSelectedFiles(id, filePaths, savePath)),

  /** 選択ファイルを削除
   * @param {{ id: string, filePaths: string[] }} args
   */
  deleteJobFiles: ({ id, filePaths }) =>
    svc().then(s => s.DeleteJobFiles(id, filePaths)),

  /** ワークスペースのジョブを一括削除（ロック済み除く最新 keepCount 件を残す）
   * @param {{ projectID: string, workspaceID: string, keepCount: number }} args
   */
  bulkDeleteJobsByWorkspace: ({ projectID, workspaceID, keepCount, dataOnly, errorOnly }) =>
    svc().then(s => s.BulkDeleteJobsByWorkspace(projectID, workspaceID, keepCount, dataOnly, errorOnly)),

  /** フィルタ条件に合致するクリーンアップ対象のジョブ統計を取得
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  getCleanableJobStats: ({ filter }) =>
    svc().then(s => s.GetCleanableJobStats(filter)),

  /** フィルタ条件に合致するジョブのデータを削除（履歴は残す）
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  cleanJobData: ({ filter }) =>
    svc().then(s => s.CleanJobData(filter)),

  /** フィルタ条件に合致するジョブの実測ディスクサイズを取得
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  measureFilteredDiskSize: ({ filter }) =>
    svc().then(s => s.MeasureFilteredDiskSize(filter)),

  /** ミニモニターウィンドウを開く */
  openMiniMonitor: () =>
    isWails() ? svc().then(s => s.OpenMiniMonitor())
              : Promise.resolve(),

  /** ミニモニターを閉じてメインウィンドウを復元 */
  closeMiniMonitor: () =>
    isWails() ? svc().then(s => s.CloseMiniMonitor())
              : Promise.resolve(),
}
