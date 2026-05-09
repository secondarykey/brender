import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/changeme').then(m => m.EnvironmentService)

export const EnvironmentApi = {
  /** 環境設定を取得 */
  get: () =>
    isWails() ? svc().then(s => s.Get())
              : serverCall('environment', 'get'),

  /** プロジェクトルートディレクトリを設定
   * @param {{ root: string }} args
   */
  setRoot: ({ root }) =>
    isWails() ? svc().then(s => s.SetRoot(root))
              : serverCall('environment', 'set_root', { root }),

  /** ダイアログのデフォルトパス用に作業ディレクトリを取得（Wails 専用） */
  getWorkDir: () =>
    isWails() ? svc().then(s => s.GetWorkDir())
              : Promise.resolve(''),
}
