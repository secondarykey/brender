import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/main/services/workdir');

export const WorkDirApi = {
  list: () =>
    isWails() ? svc().then(s => s.List())
              : serverCall('work_dir', 'list'),

  create: ({ path, priority }) =>
    isWails() ? svc().then(s => s.Create(path, priority))
              : serverCall('work_dir', 'create', { path, priority }),

  update: ({ id, path, priority, status }) =>
    isWails() ? svc().then(s => s.Update(id, path, priority, status))
              : serverCall('work_dir', 'update', { id, path, priority, status }),

  reorder: ({ ids }) =>
    isWails() ? svc().then(s => s.Reorder(ids))
              : serverCall('work_dir', 'reorder', { ids }),

  delete: ({ id }) =>
    isWails() ? svc().then(s => s.Delete(id))
              : serverCall('work_dir', 'delete', { id }),

  checkDir: ({ path }) =>
    isWails() ? svc().then(s => s.CheckDir(path))
              : serverCall('work_dir', 'check_dir', { path }),

  startMigration: ({ projectID, newWorkDirID }) =>
    isWails() ? svc().then(s => s.StartMigration(projectID, newWorkDirID))
              : serverCall('work_dir', 'start_migration', { project_id: projectID, new_work_dir_id: newWorkDirID }),

  getWorkDirStats: ({ id }) =>
    isWails() ? svc().then(s => s.GetWorkDirStats(id))
              : serverCall('work_dir', 'get_work_dir_stats', { id }),

  changeDir: ({ id, newPath }) =>
    isWails() ? svc().then(s => s.ChangeDir(id, newPath))
              : serverCall('work_dir', 'change_dir', { id, new_path: newPath }),

  getProjectDiskSize: ({ projectID }) =>
    isWails() ? svc().then(s => s.GetProjectDiskSize(projectID))
              : serverCall('work_dir', 'get_project_disk_size', { project_id: projectID }),
}
