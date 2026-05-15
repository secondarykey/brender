import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/workspace')

export const WorkspaceApi = {
  /** プロジェクト内のワークスペース一覧をファイルごとに取得
   * @param {{ projectID: string, sort?: string }} args  sort: "display_order" | "created_at" | "processed_at"
   */
  listByProject: ({ projectID, sort = '' }) =>
    isWails() ? svc().then(s => s.ListByProject(projectID, sort))
              : serverCall('workspace', 'list_by_project', { project_id: projectID, sort }),

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
   * @param {{ projectID: string, workspaceID: string, name: string,
   *           blenderInstallID: number, scene: string, camera: string, engine: string,
   *           startFrame: number, endFrame: number, frameStep: number, thread: number, samples: number }} args
   */
  update: ({ projectID, workspaceID, name, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY }) =>
    isWails() ? svc().then(s => s.Update(projectID, workspaceID, name, blenderInstallID, scene, camera, engine, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY))
              : serverCall('workspace', 'update', {
                  project_id: projectID, workspace_id: workspaceID, name,
                  blender_install_id: blenderInstallID, scene, camera, engine,
                  start_frame: startFrame, end_frame: endFrame, frame_step: frameStep, thread, samples,
                  resolution_x: resolutionX, resolution_y: resolutionY,
                }),

  /** ワークスペースを削除
   * @param {{ projectID: string, workspaceID: string }} args
   */
  delete: ({ projectID, workspaceID }) =>
    isWails() ? svc().then(s => s.Delete(projectID, workspaceID))
              : serverCall('workspace', 'delete', { project_id: projectID, workspace_id: workspaceID }),

  /** ワークスペースのサムネイル画像を base64 データURIで取得
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

  createMovie: ({ projectID, fileID, workspaceID, jobID }) =>
    isWails() ? svc().then(s => s.CreateMovie(projectID, fileID, workspaceID, jobID))
              : serverCall('workspace', 'create_movie', { project_id: projectID, file_id: fileID, workspace_id: workspaceID, job_id: jobID }),
}
