const svc = () => import('../../../bindings/main/services/workdir');

export const WorkDirApi = {
  list: () =>
    svc().then(s => s.List()),

  create: ({ path, priority }) =>
    svc().then(s => s.Create(path, priority)),

  update: ({ id, path, priority, status }) =>
    svc().then(s => s.Update(id, path, priority, status)),

  reorder: ({ ids }) =>
    svc().then(s => s.Reorder(ids)),

  delete: ({ id }) =>
    svc().then(s => s.Delete(id)),

  checkDir: ({ path }) =>
    svc().then(s => s.CheckDir(path)),

  startMigration: ({ projectID, newWorkDirID }) =>
    svc().then(s => s.StartMigration(projectID, newWorkDirID)),

  getWorkDirStats: ({ id }) =>
    svc().then(s => s.GetWorkDirStats(id)),

  changeDir: ({ id, newPath }) =>
    svc().then(s => s.ChangeDir(id, newPath)),

  getProjectDiskSize: ({ projectID }) =>
    svc().then(s => s.GetProjectDiskSize(projectID)),
}
