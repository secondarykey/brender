import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/environment');

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

  /** ffmpeg 設定を保存
   * @param {{ cmd: string, fps: number, ext: string, args: string }} args
   */
  setFfmpeg: ({ cmd, fps, ext, outExt, args }) =>
    isWails() ? svc().then(s => s.SetFfmpeg(cmd, fps, ext, outExt, args))
              : serverCall('environment', 'set_ffmpeg', { cmd, fps, ext, out_ext: outExt, args }),

  /** システムログの内容を取得 */
  getSystemLog: () =>
    isWails() ? svc().then(s => s.GetSystemLog())
              : serverCall('environment', 'get_system_log'),
}
