import { serverCall } from './_client'

const svc = () => import('../../../bindings/main/services/auth')

export const AuthApi = {
  // ── User ──────────────────────────────────────────────

  /** ユーザ一覧を取得 */
  listUsers: () =>
    svc().then(s => s.ListUsers()),

  /** ユーザを取得
   * @param {{ id: string }} args
   */
  getUser: ({ id }) =>
    svc().then(s => s.GetUser(id)),

  /** ユーザを作成
   * @param {{ name: string, displayName?: string, role?: string }} args
   */
  createUser: ({ name, displayName = '', role = '' }) =>
    svc().then(s => s.CreateUser(name, displayName, role)),

  /** ユーザを更新
   * @param {{ id: string, name: string, displayName?: string, role?: string }} args
   */
  updateUser: ({ id, name, displayName = '', role = '' }) =>
    svc().then(s => s.UpdateUser(id, name, displayName, role)),

  /** ユーザを削除
   * @param {{ id: string }} args
   */
  deleteUser: ({ id }) =>
    svc().then(s => s.DeleteUser(id)),

  // ── Group ─────────────────────────────────────────────

  /** グループ一覧を取得 */
  listGroups: () =>
    svc().then(s => s.ListGroups()),

  /** グループを取得
   * @param {{ id: string }} args
   */
  getGroup: ({ id }) =>
    svc().then(s => s.GetGroup(id)),

  /** グループを作成
   * @param {{ displayName: string }} args
   */
  createGroup: ({ displayName }) =>
    svc().then(s => s.CreateGroup(displayName)),

  /** グループを更新
   * @param {{ id: string, displayName: string }} args
   */
  updateGroup: ({ id, displayName }) =>
    svc().then(s => s.UpdateGroup(id, displayName)),

  /** グループを削除
   * @param {{ id: string }} args
   */
  deleteGroup: ({ id }) =>
    svc().then(s => s.DeleteGroup(id)),

  // ── UserGroup ─────────────────────────────────────────

  /** ユーザが所属するグループ一覧を取得
   * @param {{ userID: string }} args
   */
  listGroupsByUser: ({ userID }) =>
    svc().then(s => s.ListGroupsByUser(userID)),

  /** グループに所属するユーザ一覧を取得
   * @param {{ groupID: string }} args
   */
  listUsersByGroup: ({ groupID }) =>
    svc().then(s => s.ListUsersByGroup(groupID)),

  /** ユーザをグループに追加
   * @param {{ userID: string, groupID: string }} args
   */
  addUserToGroup: ({ userID, groupID }) =>
    svc().then(s => s.AddUserToGroup(userID, groupID)),

  /** ユーザをグループから除外
   * @param {{ userID: string, groupID: string }} args
   */
  removeUserFromGroup: ({ userID, groupID }) =>
    svc().then(s => s.RemoveUserFromGroup(userID, groupID)),

  // ── Password / Login ─────────────────────────────────────

  /** パスワード設定状態付きユーザ一覧 */
  listUsersWithStatus: () =>
    svc().then(s => s.ListUsersWithStatus()),

  /** 既存の有効なリセットトークンを取得
   * @param {{ userID: string }} args
   * @returns {Promise<{ url_path: string, expires_at: string } | null>}
   */
  getActiveResetToken: ({ userID }) =>
    svc().then(s => s.GetActiveResetToken(userID)),

  /** パスワードリセットトークンを発行
   * @param {{ userID: string }} args
   * @returns {Promise<string>} URL パス
   */
  generateResetToken: ({ userID }) =>
    svc().then(s => s.GenerateResetToken(userID)),

  /** ログイン（サーバモード用）
   * @param {{ name: string, password: string }} args
   */
  login: ({ name, password }) =>
    serverCall('auth', 'login', { name, password }),

  /** ログアウト（サーバモード用） */
  logout: () =>
    serverCall('auth', 'logout', {}),

  /** セッション検証（サーバモード用） */
  me: () =>
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(j => j.data || null),

  /** 認証が有効かを確認 */
  isAuthEnabled: () =>
    serverCall('auth', 'is_auth_enabled'),
}
