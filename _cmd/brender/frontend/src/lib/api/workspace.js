import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/workspace')

export const WorkspaceApi = {
  /** プロジェクト内のワークスペース一覧をファイルごとに取得
   * @param {{ projectID: string, sort?: string, dir?: string }} args
   */
  listByProject: ({ projectID, sort = '', dir = '' }) =>
    isWails() ? svc().then(s => s.ListByProject(projectID, sort, dir))
              : serverCall('workspace', 'list_by_project', { project_id: projectID, sort, dir }),

  /** ワークスペースを取得
   * @param {{ projectID: string, workspaceID: string }} args
   */
  get: ({ projectID, workspaceID }) =>
    isWails() ? svc().then(s => s.Get(projectID, workspaceID))
              : serverCall('workspace', 'get', { project_id: projectID, workspace_id: workspaceID }),

  /** ワークスペースを作成
   * @param {{ projectID: string, projectFileID: number, name: string }} args
   */
  create: ({ projectID, projectFileID, name }) =>
    isWails() ? svc().then(s => s.Create(projectID, projectFileID, name))
              : serverCall('workspace', 'create', { project_id: projectID, project_file_id: projectFileID, name }),

  /** ワークスペースを更新
   * @param {{ projectID: string, workspaceID: string, name: string, note: string,
   *           blenderInstallID: number, scene: string, camera: string, engine: string,
   *           startFrame: number, endFrame: number, frameStep: number, thread: number, samples: number }} args
   */
  update: ({ projectID, workspaceID, name, note = '', blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat = '', autoLock = false, autoLockMinSize = 0, autoLockKeep = 1 }) =>
    isWails() ? svc().then(s => s.Update(projectID, workspaceID, name, note, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY, outputFormat, autoLock, autoLockMinSize, autoLockKeep))
              : serverCall('workspace', 'update', {
                  project_id: projectID, workspace_id: workspaceID, name, note,
                  blender_install_id: blenderInstallID, scene, camera, engine,
                  start_frame: startFrame, end_frame: endFrame, frame_step: frameStep, thread, samples,
                  resolution_x: resolutionX, resolution_y: resolutionY,
                  output_format: outputFormat,
                  auto_lock: autoLock, auto_lock_min_size: autoLockMinSize, auto_lock_keep: autoLockKeep,
                }),

  /** ワークスペースをコピーして新規作成
   * @param {{ projectID: string, workspaceID: string, newName: string }} args
   */
  copy: ({ projectID, workspaceID, newName }) =>
    isWails() ? svc().then(s => s.Copy(projectID, workspaceID, newName))
              : serverCall('workspace', 'copy', { project_id: projectID, workspace_id: workspaceID, new_name: newName }),

  /** ワークスペースを削除
   * @param {{ projectID: string, workspaceID: string, force?: boolean }} args
   */
  delete: ({ projectID, workspaceID, force = false }) =>
    isWails() ? svc().then(s => s.Delete(projectID, workspaceID, force))
              : serverCall('workspace', 'delete', { project_id: projectID, workspace_id: workspaceID, force }),

  /** ワークスペースのサムネイルを取得。Wails は base64、サーバモードは配信URL。
   * @param {{ projectID: string, fileID: string, workspaceID: string }} args
   */
  getThumbnail: ({ projectID, fileID, workspaceID }) =>
    isWails() ? svc().then(s => s.GetThumbnail(projectID, fileID, workspaceID))
              : serverCall('workspace', 'get_thumbnail', { project_id: projectID, file_id: fileID, workspace_id: workspaceID }),

  /** 画像ファイルをワークスペースサムネイルに設定し、base64 データURIを返す
   * @param {{ projectID: string, fileID: string, workspaceID: string, imagePath: string }} args
   */
  setThumbnail: ({ projectID, fileID, workspaceID, imagePath }) =>
    isWails() ? svc().then(s => s.SetThumbnail(projectID, fileID, workspaceID, imagePath))
              : serverCall('workspace', 'set_thumbnail', { project_id: projectID, file_id: fileID, workspace_id: workspaceID, image_path: imagePath }),

  /** ワークスペースを一括作成（エンジン・シーン・カメラの組み合わせ）
   * @param {{ projectID: string, projectFileID: string, specs: Array<{name:string, scene:string, camera:string, engine:string}> }} args
   */
  createBatch: ({ projectID, projectFileID, specs }) =>
    isWails() ? svc().then(s => s.CreateBatch(projectID, projectFileID, specs))
              : serverCall('workspace', 'create_batch', { project_id: projectID, project_file_id: projectFileID, specs }),

  createMovie: ({ projectID, fileID, workspaceID, jobID, fps, outext, extraArgs }) =>
    isWails() ? svc().then(s => s.CreateMovie(projectID, fileID, workspaceID, jobID, fps, outext, extraArgs))
              : serverCall('workspace', 'create_movie', { project_id: projectID, file_id: fileID, workspace_id: workspaceID, job_id: jobID, fps, outext, extra_args: extraArgs }),
}
