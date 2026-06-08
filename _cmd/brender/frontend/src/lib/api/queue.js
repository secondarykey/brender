import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/queue')

export const QueueApi = {
  /** レンダリング前パラメータをプレビュー解決
   * @param {{ projectID: string, workspaceID: string }} args
   */
  previewRender: ({ projectID, workspaceID }) =>
    isWails() ? svc().then(s => s.PreviewRender(projectID, workspaceID))
              : serverCall('queue', 'preview_render', { project_id: projectID, workspace_id: workspaceID }),

  /** プレビュー済みパラメータでキューに追加
   * @param {{ projectID: string, workspaceID: string, preview: object }} args
   */
  enqueueWithPreview: ({ projectID, workspaceID, preview }) =>
    isWails() ? svc().then(s => s.EnqueueWithPreview(projectID, workspaceID, preview))
              : serverCall('queue', 'enqueue_with_preview', { project_id: projectID, workspace_id: workspaceID, preview }),

  /** テストレンダリング（サンプル8・中間1フレーム）をキューに追加
   * @param {{ projectID: string, workspaceID: string, params: object }} args
   */
  testEnqueue: ({ projectID, workspaceID, params }) =>
    isWails() ? svc().then(s => s.TestEnqueue(projectID, workspaceID, params))
              : serverCall('queue', 'test_enqueue', { project_id: projectID, workspace_id: workspaceID, params }),

  /** サンプル比較レンダリングをキューに追加
   * @param {{ projectID: string, workspaceID: string, sampleCounts: number[], frame: number }} args
   */
  samplesComparisonEnqueue: ({ projectID, workspaceID, sampleCounts, frame }) =>
    isWails() ? svc().then(s => s.SamplesComparisonEnqueue(projectID, workspaceID, sampleCounts, frame))
              : serverCall('queue', 'samples_comparison_enqueue', { project_id: projectID, workspace_id: workspaceID, sample_counts: sampleCounts, frame }),

  /** 実行中キュー一覧を取得 */
  list: () =>
    isWails() ? svc().then(s => s.List())
              : serverCall('queue', 'list'),

  /** 実行中キューをライブ進捗付きで取得 */
  listItems: () =>
    isWails() ? svc().then(s => s.ListItems())
              : serverCall('queue', 'list_items'),

  /** キューをキャンセル
   * @param {{ id: string }} args
   */
  cancel: ({ id }) =>
    isWails() ? svc().then(s => s.Cancel(id))
              : serverCall('queue', 'cancel', { id }),

  killRunning: () =>
    isWails() ? svc().then(s => s.KillRunning())
              : serverCall('queue', 'kill_running'),

  /** ジョブ履歴一覧を取得 */
  listJobs: () =>
    isWails() ? svc().then(s => s.ListJobs())
              : serverCall('queue', 'list_jobs'),

  /** ジョブ履歴をページング付きで取得
   * @param {{ filter: { data_statuses?: number[], days?: number, sort_by?: string }, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number, total_size: number }>}
   */
  listJobsPaged: ({ filter, page, pageSize }) =>
    isWails() ? svc().then(s => s.ListJobsPaged(filter, page, pageSize))
              : serverCall('queue', 'list_jobs_paged', { filter, page, page_size: pageSize }),

  /** ワークスペース別ジョブ履歴を取得
   * @param {{ projectID: string, workspaceID: string }} args
   */
  listJobsByWorkspace: ({ projectID, workspaceID }) =>
    isWails() ? svc().then(s => s.ListJobsByWorkspace(projectID, workspaceID))
              : serverCall('queue', 'list_jobs_by_workspace', { project_id: projectID, workspace_id: workspaceID }),

  /** ワークスペース別ジョブ履歴をページング付きで取得
   * @param {{ projectID: string, workspaceID: string, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number }>}
   */
  listJobsByWorkspacePaged: ({ projectID, workspaceID, page, pageSize }) =>
    isWails() ? svc().then(s => s.ListJobsByWorkspacePaged(projectID, workspaceID, page, pageSize))
              : serverCall('queue', 'list_jobs_by_workspace_paged', { project_id: projectID, workspace_id: workspaceID, page, page_size: pageSize }),

  /** ファイル別ジョブ履歴を取得
   * @param {{ projectID: string, fileID: number }} args
   */
  listJobsByProjectFile: ({ projectID, fileID }) =>
    isWails() ? svc().then(s => s.ListJobsByProjectFile(projectID, fileID))
              : serverCall('queue', 'list_jobs_by_project_file', { project_id: projectID, file_id: fileID }),

  /** ファイル別ジョブ履歴をページング付きで取得
   * @param {{ projectID: string, fileID: string, page: number, pageSize: number }} args
   * @returns {Promise<{ jobs: Job[], total: number }>}
   */
  listJobsByProjectFilePaged: ({ projectID, fileID, page, pageSize }) =>
    isWails() ? svc().then(s => s.ListJobsByProjectFilePaged(projectID, fileID, page, pageSize))
              : serverCall('queue', 'list_jobs_by_project_file_paged', { project_id: projectID, file_id: fileID, page, page_size: pageSize }),

  /** ジョブ単体を取得
   * @param {{ id: string }} args
   */
  getJob: ({ id }) =>
    isWails() ? svc().then(s => s.GetJob(id))
              : serverCall('queue', 'get_job', { id }),

  /** ジョブの名称とノートを更新
   * @param {{ id: string, name: string, note: string }} args
   */
  updateJobMeta: ({ id, name, note }) =>
    isWails() ? svc().then(s => s.UpdateJobMeta(id, name, note))
              : serverCall('queue', 'update_job_meta', { id, name, note }),

  /** ジョブを削除
   * @param {{ id: string }} args
   */
  deleteJob: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteJob(id))
              : serverCall('queue', 'delete_job', { id }),

  /** 出力データのみ削除（ジョブ履歴は残す）
   * @param {{ id: string }} args
   */
  deleteJobData: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteJobData(id))
              : serverCall('queue', 'delete_job_data', { id }),

  /** ジョブの出力ディレクトリにある画像パス一覧を取得
   * @param {{ id: string }} args
   */
  listJobImages: ({ id }) =>
    isWails() ? svc().then(s => s.ListJobImages(id))
              : serverCall('queue', 'list_job_images', { id }),

  /** ジョブの出力ディレクトリにある全ファイル情報を取得
   * @param {{ id: string }} args
   */
  listJobFiles: ({ id }) =>
    isWails() ? svc().then(s => s.ListJobFiles(id))
              : serverCall('queue', 'list_job_files', { id }),

  /** 画像ファイルを base64 データ URI として取得
   * @param {{ path: string }} args
   */
  getImageBase64: ({ path }) =>
    isWails() ? svc().then(s => s.GetImageBase64(path))
              : serverCall('queue', 'get_image_base64', { path }),

  /** ジョブをロック
   * @param {{ id: string }} args
   */
  lockJob: ({ id }) =>
    isWails() ? svc().then(s => s.LockJob(id))
              : serverCall('queue', 'lock_job', { id }),

  /** ジョブのロックを解除
   * @param {{ id: string }} args
   */
  unlockJob: ({ id }) =>
    isWails() ? svc().then(s => s.UnlockJob(id))
              : serverCall('queue', 'unlock_job', { id }),

  /** render.log の内容を取得
   * @param {{ id: string }} args
   */
  getJobLog: ({ id }) =>
    isWails() ? svc().then(s => s.GetJobLog(id))
              : serverCall('queue', 'get_job_log', { id }),

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
    isWails() ? svc().then(s => s.ZipJobData(id, savePath))
              : serverCall('queue', 'zip_job_data', { id, save_path: savePath }),

  /** 選択ファイルを ZIP 圧縮して指定パスに保存
   * @param {{ id: string, filePaths: string[], savePath: string }} args
   */
  zipJobSelectedFiles: ({ id, filePaths, savePath }) =>
    isWails() ? svc().then(s => s.ZipJobSelectedFiles(id, filePaths, savePath))
              : serverCall('queue', 'zip_job_selected_files', { id, file_paths: filePaths, save_path: savePath }),

  /** 選択ファイルを削除
   * @param {{ id: string, filePaths: string[] }} args
   */
  deleteJobFiles: ({ id, filePaths }) =>
    isWails() ? svc().then(s => s.DeleteJobFiles(id, filePaths))
              : serverCall('queue', 'delete_job_files', { id, file_paths: filePaths }),

  /** ワークスペースのジョブを一括削除（ロック済み除く最新 keepCount 件を残す）
   * @param {{ projectID: string, workspaceID: string, keepCount: number }} args
   */
  bulkDeleteJobsByWorkspace: ({ projectID, workspaceID, keepCount, dataOnly, errorOnly }) =>
    isWails() ? svc().then(s => s.BulkDeleteJobsByWorkspace(projectID, workspaceID, keepCount, dataOnly, errorOnly))
              : serverCall('queue', 'bulk_delete_jobs_by_workspace', { project_id: projectID, workspace_id: workspaceID, keep_count: keepCount, data_only: dataOnly, error_only: errorOnly }),

  /** フィルタ条件に合致するクリーンアップ対象のジョブ統計を取得
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  getCleanableJobStats: ({ filter }) =>
    isWails() ? svc().then(s => s.GetCleanableJobStats(filter))
              : serverCall('queue', 'get_cleanable_job_stats', { filter }),

  /** フィルタ条件に合致するジョブのデータを削除（履歴は残す）
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  cleanJobData: ({ filter }) =>
    isWails() ? svc().then(s => s.CleanJobData(filter))
              : serverCall('queue', 'clean_job_data', { filter }),

  /** フィルタ条件に合致するジョブの実測ディスクサイズを取得
   * @param {{ filter: { data_statuses: number[], days: number } }} args
   */
  measureFilteredDiskSize: ({ filter }) =>
    isWails() ? svc().then(s => s.MeasureFilteredDiskSize(filter))
              : serverCall('queue', 'measure_filtered_disk_size', { filter }),

  /** ミニモニターウィンドウを開く */
  openMiniMonitor: () =>
    isWails() ? svc().then(s => s.OpenMiniMonitor())
              : Promise.resolve(),

  /** ミニモニターを閉じてメインウィンドウを復元 */
  closeMiniMonitor: () =>
    isWails() ? svc().then(s => s.CloseMiniMonitor())
              : Promise.resolve(),
}
