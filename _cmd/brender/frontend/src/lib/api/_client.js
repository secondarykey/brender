/**
 * _client.js — API クライアント共通ユーティリティ
 *
 * isWails()  : Wails デスクトップモードかどうかを判定
 * serverCall : サーバモード時の REST API 呼び出し共通処理
 *
 * サーバモードの規約:
 *   POST /api/{service}/{method}
 *   Body: JSON オブジェクト（引数）
 *   Response: { data: any } | { error: string }
 *   エラー時は throw するため、呼び出し側は Wails モードと同じ try/catch で扱える。
 */

export const isWails = () => Boolean(window._wails) && !window.__brender_server_mode

/**
 * @param {string} service  - サービス名 (例: 'blender')
 * @param {string} method   - メソッド名 (例: 'list')
 * @param {object} [args]   - リクエストボディに渡す引数オブジェクト
 * @returns {Promise<any>}
 */
export async function serverCall(service, method, args = {}) {
  const res = await fetch(`/api/${service}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  // セッション期限切れ → ページリロードでログイン画面に遷移
  if (res.status === 401) {
    window.location.reload()
    throw new Error('unauthorized')
  }
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.data
}
