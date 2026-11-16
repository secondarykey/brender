// ファイルに対するロール（弱い順）。サーバの api/access.go の rolesRunnerUp・rolesEditorUp と同じ並び。
const ORDER = ['viewer', 'runner', 'editor', 'workspace_creator', 'owner']

// role が min 以上か。知らないロール（空を含む）は何もできない側に倒す。
export function roleAtLeast(role, min) {
  const r = ORDER.indexOf(role)
  return r !== -1 && r >= ORDER.indexOf(min)
}
