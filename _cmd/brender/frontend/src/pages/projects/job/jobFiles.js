// 実行結果（ジョブ）の画面で使う、出力ファイルとデータの状態の決まりごと

export const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])
export const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.exr', '.tiff', '.tif', '.bmp', '.hdr', '.webp', '.tga'])
export const LOG_EXTS   = new Set(['.log'])

function hasExt(name, exts) {
  const dot = name.lastIndexOf('.')
  return dot !== -1 && exts.has(name.slice(dot).toLowerCase())
}
export const isVideoFile = name => hasExt(name, VIDEO_EXTS)
export const isImageFile = name => hasExt(name, IMAGE_EXTS)
export const hasFileExt  = hasExt

// Job.DataStatus: 偶数が状態、+1 でロック付き（0=なし 2=あり 4=削除済み 6=壊れている 8=変更あり）
export const isJobLocked = status => status % 2 === 1
// 出力が残っていて見られる・ダウンロードできる状態（あり・壊れている・変更あり。ロック付きも含む）
export const hasJobData  = status => [2, 3, 6, 7, 8, 9].includes(status)

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1)
  const val = bytes / Math.pow(1024, i)
  return `${i === 0 ? val : val.toFixed(2)} ${units[i]}`
}

// 開始から完了までの時間（どちらかが無ければ「—」）
export function jobDuration(startedAt, completedAt, t) {
  if (!startedAt || !completedAt) return '—'
  const sec = Math.floor((new Date(completedAt) - new Date(startedAt)) / 1000)
  if (sec < 60) return `${sec}${t('time.seconds')}`
  if (sec < 3600) return `${Math.floor(sec / 60)}${t('time.minutes')}${sec % 60}${t('time.seconds')}`
  return `${Math.floor(sec / 3600)}${t('time.hours')}${Math.floor((sec % 3600) / 60)}${t('time.minutes')}`
}

const MIME_MAP = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  exr: 'image/x-exr', tiff: 'image/tiff', tif: 'image/tiff',
  bmp: 'image/bmp', webp: 'image/webp', hdr: 'image/vnd.radiance',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  mkv: 'video/x-matroska', webm: 'video/webm', m4v: 'video/mp4',
  log: 'text/plain', txt: 'text/plain',
}

// base64 のデータ URI を、拡張子に合った種類のファイルとしてブラウザのダウンロードで保存させる
export function downloadDataUri(dataUri, filename) {
  const base64 = dataUri.split(',')[1]
  const ext = filename.split('.').pop().toLowerCase()
  const mime = MIME_MAP[ext] || 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
