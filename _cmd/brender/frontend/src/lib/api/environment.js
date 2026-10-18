import { isWails } from './_client'

const svc = () => import('../../../bindings/main/services/environment');

export const EnvironmentApi = {
  /** 環境設定を取得 */
  get: () =>
    svc().then(s => s.Get()),

  /** ffmpeg 設定を保存
   * @param {{ cmd: string, fps: number, ext: string, args: string }} args
   */
  setFfmpeg: ({ cmd, fps, outExt, args }) =>
    svc().then(s => s.SetFfmpeg(cmd, fps, outExt, args)),

  /** システムログの内容を取得 */
  getSystemLog: () =>
    svc().then(s => s.GetSystemLog()),

  /** 現在のログレベル名を取得 */
  getLogLevel: () =>
    svc().then(s => s.GetLogLevel()),

  /** 利用可能なログレベル名一覧を取得 */
  getLogLevels: () =>
    svc().then(s => s.GetLogLevels()),

  /** ログレベルを変更 */
  setLogLevel: ({ level }) =>
    svc().then(s => s.SetLogLevel(level)),

  /** サーバモードの設定を保存 */
  setServer: ({ enabled, host, port, auth }) =>
    svc().then(s => s.SetServer(enabled, host, port, auth)),

  /** レンダリング出力フォーマットを設定（"PNG" / "JPEG"） */
  setOutputFormat: ({ format }) =>
    svc().then(s => s.SetOutputFormat(format)),

  /** 最大同時実行数を設定 */
  setMaxConcurrentJobs: ({ n }) =>
    svc().then(s => s.SetMaxConcurrentJobs(n)),

  /** システムログを別ウィンドウで開く */
  openSystemLogWindow: () =>
    isWails() ? svc().then(s => s.OpenSystemLogWindow())
              : Promise.resolve(),

  /** バージョン情報を取得 */
  getVersion: () =>
    svc().then(s => s.GetVersion()),

  /** ライセンス情報を取得 */
  getLicenses: () =>
    svc().then(s => s.GetLicenses()),
}
