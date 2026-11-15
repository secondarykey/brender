// OS のファイルダイアログ（@wailsio/runtime の Dialogs）を包む。
// ダイアログはここを通して開き、Dialogs.OpenFile / SaveFile をページから直接呼ばない。
//
// Windows だけ、ダイアログを取り消すと Promise が reject される（Wails v3.0.0。
// 文言に "cancelled by user" が入る。macOS・Linux は空文字が返る）。
// 取り消しはエラーではないので、ここで空文字に揃える。呼ぶ側は「空なら何もしない」だけにする。
import { Dialogs } from '@wailsio/runtime'

const CANCELLED_MSG = 'cancelled by user'

export function isDialogCancelled(err) {
  if (err == null) return false
  return String(err?.message ?? err).includes(CANCELLED_MSG)
}

async function pathOf(open) {
  try {
    return (await open()) || ''
  } catch (err) {
    if (isDialogCancelled(err)) return ''
    throw err
  }
}

// ファイルを 1 つ選ぶ。取り消しは ''。
export function openFile(options = {}) {
  return pathOf(() => Dialogs.OpenFile({ ...options, AllowsMultipleSelection: false }))
}

// フォルダを 1 つ選ぶ。取り消しは ''。
export function openDirectory(options = {}) {
  return pathOf(() => Dialogs.OpenFile({
    ...options,
    CanChooseDirectories: true,
    CanChooseFiles: false,
    AllowsMultipleSelection: false,
  }))
}

// 保存先を選ぶ。取り消しは ''。
export function saveFile(options = {}) {
  return pathOf(() => Dialogs.SaveFile(options))
}
