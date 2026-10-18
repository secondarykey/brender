const svc = () => import('../../../bindings/main/services/blender')

export const BlenderApi = {
  /** Blender インストール一覧を取得 */
  list: () =>
    svc().then(s => s.List()),

  /** Blender を登録
   * @param {{ path: string }} args
   */
  register: ({ path }) =>
    svc().then(s => s.Register(path)),

  /** Blender を削除
   * @param {{ id: number }} args
   */
  delete: ({ id }) =>
    svc().then(s => s.Delete(id)),

  /** Blender を参照しているワークスペース・ファイル・プロジェクトを取得
   * @param {{ id: number }} args
   */
  references: ({ id }) =>
    svc().then(s => s.References(id)),

  /** 参照しているワークスペース・ファイルをデフォルト設定に戻す
   * @param {{ id: number }} args
   */
  resetReferences: ({ id }) =>
    svc().then(s => s.ResetReferences(id)),

  /** Blender の並び順を更新
   * @param {{ ids: number[] }} args
   */
  reorder: ({ ids }) =>
    svc().then(s => s.Reorder(ids)),

  /** レンダーエンジン一覧を取得
   * @param {{ installID: number }} args
   */
  getEngines: ({ installID }) =>
    svc().then(s => s.GetEngines(installID)),

  /** シーン一覧を取得
   * @param {{ installID: number, fileID: number }} args
   */
  getScenes: ({ installID, fileID }) =>
    svc().then(s => s.GetScenes(installID, fileID)),

  /** カメラ一覧を取得
   * @param {{ installID: number, fileID: string }} args
   */
  getCameras: ({ installID, fileID }) =>
    svc().then(s => s.GetCameras(installID, fileID)),

  /** Tool データ（シーン詳細・カメラ一覧）を一括取得
   * @param {{ installID: number, fileID: string }} args
   */
  getToolData: ({ installID, fileID }) =>
    svc().then(s => s.GetToolData(installID, fileID)),

  /** 起動時 Blender 検証の警告一覧を取得 */
  warnings: () =>
    svc().then(s => s.Warnings()),

  /** 実行ファイルが存在しない Blender の ID 一覧を取得（軽量チェック） */
  checkPaths: () =>
    svc().then(s => s.CheckPaths()),

  /** システムの論理 CPU コア数を取得 */
  getCPUCount: () =>
    svc().then(s => s.GetCPUCount()),

  /** Blender GUI でファイルを開く（非同期・ノンブロッキング）
   * @param {{ installID: number, filePath: string }} args
   */
  openFile: ({ installID, filePath }) =>
    svc().then(s => s.OpenFile(installID, filePath)),
}
