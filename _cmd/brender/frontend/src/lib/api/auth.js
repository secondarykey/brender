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
   * @param {{ name: string, displayName?: string }} args
   */
  createUser: ({ name, displayName = '' }) =>
    isWails() ? svc().then(s => s.CreateUser(name, displayName))
              : serverCall('auth', 'create_user', { name, display_name: displayName }),

  /** ユーザを更新
   * @param {{ id: string, name: string, displayName?: string }} args
   */
  updateUser: ({ id, name, displayName = '' }) =>
    isWails() ? svc().then(s => s.UpdateUser(id, name, displayName))
              : serverCall('auth', 'update_user', { id, name, display_name: displayName }),

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
   * @param {{ name: string, displayName?: string }} args
   */
  createGroup: ({ name, displayName = '' }) =>
    isWails() ? svc().then(s => s.CreateGroup(name, displayName))
              : serverCall('auth', 'create_group', { name, display_name: displayName }),

  /** グループを更新
   * @param {{ id: string, name: string, displayName?: string }} args
   */
  updateGroup: ({ id, name, displayName = '' }) =>
    isWails() ? svc().then(s => s.UpdateGroup(id, name, displayName))
              : serverCall('auth', 'update_group', { id, name, display_name: displayName }),

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
}
