import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/main/services/environment');

export const EnvironmentApi = {
  /** 環境設定を取得 */
  get: () =>
    isWails() ? svc().then(s => s.Get())
              : serverCall('environment', 'get'),

  /** ffmpeg 設定を保存
   * @param {{ cmd: string, fps: number, ext: string, args: string }} args
   */
  setFfmpeg: ({ cmd, fps, outExt, args }) =>
    isWails() ? svc().then(s => s.SetFfmpeg(cmd, fps, outExt, args))
              : serverCall('environment', 'set_ffmpeg', { cmd, fps, out_ext: outExt, args }),

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

  /** サーバモードの設定を保存 */
  setServer: ({ enabled, host, port, auth }) =>
    isWails() ? svc().then(s => s.SetServer(enabled, host, port, auth))
              : serverCall('environment', 'set_server', { enabled, host, port, auth }),

  /** レンダリング出力フォーマットを設定（"PNG" / "JPEG"） */
  setOutputFormat: ({ format }) =>
    isWails() ? svc().then(s => s.SetOutputFormat(format))
              : serverCall('environment', 'set_output_format', { format }),

  /** 最大同時実行数を設定 */
  setMaxConcurrentJobs: ({ n }) =>
    isWails() ? svc().then(s => s.SetMaxConcurrentJobs(n))
              : serverCall('environment', 'set_max_concurrent_jobs', { n }),

  /** システムログを別ウィンドウで開く */
  openSystemLogWindow: () =>
    isWails() ? svc().then(s => s.OpenSystemLogWindow())
              : Promise.resolve(),

  /** バージョン情報を取得 */
  getVersion: () =>
    isWails() ? svc().then(s => s.GetVersion())
              : serverCall('environment', 'get_version'),

  /** ライセンス情報を取得 */
  getLicenses: () =>
    isWails() ? svc().then(s => s.GetLicenses())
              : serverCall('environment', 'get_licenses'),
}
