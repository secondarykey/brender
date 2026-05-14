import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/environment');

export const EnvironmentApi = {
  /** 環境設定を取得 */
  get: () =>
    isWails() ? svc().then(s => s.Get())
              : serverCall('environment', 'get'),

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

  /** 現在のログレベル名を取得 */
  getLogLevel: () =>
    isWails() ? svc().then(s => s.GetLogLevel())
              : serverCall('environment', 'get_log_level'),

  /** 利用可能なログレベル名一覧を取得 */
  getLogLevels: () =>
    isWails() ? svc().then(s => s.GetLogLevels())
              : serverCall('environment', 'get_log_levels'),

  /** ログレベルを変更 */
  setLogLevel: ({ level }) =>
    isWails() ? svc().then(s => s.SetLogLevel(level))
              : serverCall('environment', 'set_log_level', { level }),

  /** システムログを別ウィンドウで開く */
  openSystemLogWindow: () =>
    isWails() ? svc().then(s => s.OpenSystemLogWindow())
              : Promise.resolve(),
}
