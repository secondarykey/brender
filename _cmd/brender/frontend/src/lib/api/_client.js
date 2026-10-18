/**
 * _client.js — API クライアント共通ユーティリティ
 *
 * 各ラッパーは、ウィンドウ（Wails）でもブラウザ（サーバモード）でも同じ Wails のバインディングを呼ぶ。
 * ブラウザでは、バインディングの呼び出しが POST /wails/runtime でサーバへ届く（api/rest/runtime.go）。
 *
 * isWails()  : Wails のウィンドウの中かどうか。見た目の分かれ道（ウィンドウ操作・ダイアログ・
 *              イベントの受け方・別ウィンドウを開くかタブで開くか）にだけ使う
 * serverCall : ログイン前に使う認証の口（POST /api/auth/...）を呼ぶ
 */

import { setTransport, clientId } from '@wailsio/runtime'

// サーバモードでもバンドル内の @wailsio/runtime が window._wails をセットするため、
// サーバが index.html に差し込む __brender_server_mode で見分ける。
export const isWails = () => Boolean(window._wails) && !window.__brender_server_mode

/**
 * ブラウザでのバインディングの呼び出し。@wailsio/runtime の既定の呼び出しと同じ形で
 * POST /wails/runtime へ送り、セッション切れ（401）ならページを読み直してログイン画面へ戻す。
 * 大きい本文をチャンクで分けて送る仕組み（WebView2 のため）は使わない（サーバが断る）。
 */
async function browserRuntimeCall(objectID, method, windowName, args) {
  const body = { object: objectID, method }
  if (args !== null && args !== undefined) body.args = args

  const res = await fetch('/wails/runtime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-wails-client-id': clientId },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (res.status === 401) {
    window.location.reload()
    throw new Error('unauthorized')
  }

  const json = (res.headers.get('Content-Type') || '').includes('application/json')
  if (!res.ok) {
    if (json) {
      const j = await res.json()
      const err = new Error(j.message ?? j.error)
      err.cause = j.cause
      throw err
    }
    throw new Error(await res.text())
  }
  return json ? res.json() : res.text()
}

if (window.__brender_server_mode) {
  setTransport({ call: browserRuntimeCall })
}

/**
 * @param {string} service  - サービス名 (例: 'auth')
 * @param {string} method   - メソッド名 (例: 'login')
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
