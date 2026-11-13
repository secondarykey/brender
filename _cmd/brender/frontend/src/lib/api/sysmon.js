const svc = () => import('../../../bindings/main/services/sysmon');

export const SysMonApi = {
  // システムモニタを動かし続ける。表示しているあいだ、バックエンドの TTL（15 秒）より短い間隔で呼ぶ。
  // すでに動いていたときは直近の値、動かし始めたときは null が返る（最初の値は system:stats で届く）。
  keep: () =>
    svc().then(s => s.Keep()),
}
