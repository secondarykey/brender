import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/auth')

export const AuthApi = {
  // ── User ──────────────────────────────────────────────

  /** ユーザ一覧を取得 */
  listUsers: () =>
    isWails() ? svc().then(s => s.ListUsers())
              : serverCall('auth', 'list_users'),

  /** ユーザを取得
   * @param {{ id: string }} args
   */
  getUser: ({ id }) =>
    isWails() ? svc().then(s => s.GetUser(id))
              : serverCall('auth', 'get_user', { id }),

  /** ユーザを作成
   * @param {{ name: string, displayName?: string, role?: string }} args
   */
  createUser: ({ name, displayName = '', role = '' }) =>
    isWails() ? svc().then(s => s.CreateUser(name, displayName, role))
              : serverCall('auth', 'create_user', { name, display_name: displayName, role }),

  /** ユーザを更新
   * @param {{ id: string, name: string, displayName?: string, role?: string }} args
   */
  updateUser: ({ id, name, displayName = '', role = '' }) =>
    isWails() ? svc().then(s => s.UpdateUser(id, name, displayName, role))
              : serverCall('auth', 'update_user', { id, name, display_name: displayName, role }),

  /** ユーザを削除
   * @param {{ id: string }} args
   */
  deleteUser: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteUser(id))
              : serverCall('auth', 'delete_user', { id }),

  // ── Group ─────────────────────────────────────────────

  /** グループ一覧を取得 */
  listGroups: () =>
    isWails() ? svc().then(s => s.ListGroups())
              : serverCall('auth', 'list_groups'),

  /** グループを取得
   * @param {{ id: string }} args
   */
  getGroup: ({ id }) =>
    isWails() ? svc().then(s => s.GetGroup(id))
              : serverCall('auth', 'get_group', { id }),

  /** グループを作成
   * @param {{ displayName: string }} args
   */
  createGroup: ({ displayName }) =>
    isWails() ? svc().then(s => s.CreateGroup(displayName))
              : serverCall('auth', 'create_group', { display_name: displayName }),

  /** グループを更新
   * @param {{ id: string, displayName: string }} args
   */
  updateGroup: ({ id, displayName }) =>
    isWails() ? svc().then(s => s.UpdateGroup(id, displayName))
              : serverCall('auth', 'update_group', { id, display_name: displayName }),

  /** グループを削除
   * @param {{ id: string }} args
   */
  deleteGroup: ({ id }) =>
    isWails() ? svc().then(s => s.DeleteGroup(id))
              : serverCall('auth', 'delete_group', { id }),

  // ── UserGroup ─────────────────────────────────────────

  /** ユーザが所属するグループ一覧を取得
   * @param {{ userID: string }} args
   */
  listGroupsByUser: ({ userID }) =>
    isWails() ? svc().then(s => s.ListGroupsByUser(userID))
              : serverCall('auth', 'list_groups_by_user', { user_id: userID }),

  /** グループに所属するユーザ一覧を取得
   * @param {{ groupID: string }} args
   */
  listUsersByGroup: ({ groupID }) =>
    isWails() ? svc().then(s => s.ListUsersByGroup(groupID))
              : serverCall('auth', 'list_users_by_group', { group_id: groupID }),

  /** ユーザをグループに追加
   * @param {{ userID: string, groupID: string }} args
   */
  addUserToGroup: ({ userID, groupID }) =>
    isWails() ? svc().then(s => s.AddUserToGroup(userID, groupID))
              : serverCall('auth', 'add_user_to_group', { user_id: userID, group_id: groupID }),

  /** ユーザをグループから除外
   * @param {{ userID: string, groupID: string }} args
   */
  removeUserFromGroup: ({ userID, groupID }) =>
    isWails() ? svc().then(s => s.RemoveUserFromGroup(userID, groupID))
              : serverCall('auth', 'remove_user_from_group', { user_id: userID, group_id: groupID }),

  // ── Password / Login ─────────────────────────────────────

  /** パスワード設定状態付きユーザ一覧 */
  listUsersWithStatus: () =>
    isWails() ? svc().then(s => s.ListUsersWithStatus())
              : serverCall('auth', 'list_users_with_status'),

  /** 既存の有効なリセットトークンを取得
   * @param {{ userID: string }} args
   * @returns {Promise<{ url_path: string, expires_at: string } | null>}
   */
  getActiveResetToken: ({ userID }) =>
    isWails() ? svc().then(s => s.GetActiveResetToken(userID))
              : serverCall('auth', 'get_active_reset_token', { user_id: userID }),

  /** パスワードリセットトークンを発行
   * @param {{ userID: string }} args
   * @returns {Promise<string>} URL パス
   */
  generateResetToken: ({ userID }) =>
    isWails() ? svc().then(s => s.GenerateResetToken(userID))
              : serverCall('auth', 'generate_reset_token', { user_id: userID }),

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
