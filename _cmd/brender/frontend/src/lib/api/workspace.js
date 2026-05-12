import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/workspace')

export const WorkspaceApi = {
  /** プロジェクト内のワークスペース一覧をファイルごとに取得
   * @param {{ projectID: string }} args
   */
  listByProject: ({ projectID }) =>
    isWails() ? svc().then(s => s.ListByProject(projectID))
              : serverCall('workspace', 'list_by_project', { project_id: projectID }),

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
   *           blenderInstallID: number, scene: string, engine: string,
   *           startFrame: number, endFrame: number, frameStep: number, thread: number, samples: number }} args
   */
  update: ({ projectID, workspaceID, name, blenderInstallID, scene, engine, startFrame, endFrame, frameStep, thread, samples }) =>
    isWails() ? svc().then(s => s.Update(projectID, workspaceID, name, blenderInstallID, scene, engine, startFrame, endFrame, frameStep, thread, samples))
              : serverCall('workspace', 'update', {
                  project_id: projectID, workspace_id: workspaceID, name,
                  blender_install_id: blenderInstallID, scene, engine,
                  start_frame: startFrame, end_frame: endFrame, frame_step: frameStep, thread, samples,
                }),

  /** ワークスペースを削除
   * @param {{ projectID: string, workspaceID: string }} args
   */
  delete: ({ projectID, workspaceID }) =>
    isWails() ? svc().then(s => s.Delete(projectID, workspaceID))
              : serverCall('workspace', 'delete', { project_id: projectID, workspace_id: workspaceID }),
}
