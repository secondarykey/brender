// migrateErrorMessage は作業ディレクトリの移動（workdir:migrate・workdir:changedir の error）の
// 失敗を画面に出す文言にする。サーバから理由が来ていれば後ろに付ける。
export function migrateErrorMessage(t, reason) {
  const base = t('project.migrateError')
  return reason ? `${base}: ${reason}` : base
}
