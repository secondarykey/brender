/**
 * appEvents — トランスポート非依存のイベントバス
 *
 * Wails デスクトップモードでは @wailsio/runtime の Events を使用し、
 * Web（サーバ）モードでは SSE (Server-Sent Events) にフォールバックする。
 *
 * 使い方:
 *   import { onAppEvent } from '../lib/appEvents'
 *
 *   useEffect(() => {
 *     const off = onAppEvent('queue:changed', count => { ... })
 *     return off  // アンマウント時に購読解除
 *   }, [])
 */

const isWails = () => Boolean(window._wails) && !window.__brender_server_mode

// ── SSE シングルトン管理 ──────────────────────────────────
// Web モード時に複数コンポーネントが onAppEvent を呼んでも
// SSE 接続は1本だけ保持する。

let _es = null
let _sseListeners = new Map()   // name → Set<callback>

function _getOrCreateEventSource(url = '/events') {
  if (_es) return _es
  _es = new EventSource(url)
  _es.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data)   // { name, data }
      const cbs = _sseListeners.get(msg.name)
      if (cbs) cbs.forEach(cb => cb(msg.data))
    } catch {
      // ignore malformed messages
    }
  })
  // エラー時は EventSource が自動リトライするため何もしない
  return _es
}

function _sseOn(name, callback) {
  _getOrCreateEventSource()
  if (!_sseListeners.has(name)) _sseListeners.set(name, new Set())
  _sseListeners.get(name).add(callback)

  return () => {
    const cbs = _sseListeners.get(name)
    if (!cbs) return
    cbs.delete(callback)
    if (cbs.size === 0) _sseListeners.delete(name)
    // SSE 接続自体は他のイベント名が使う可能性があるため閉じない
  }
}

// ── Wails モード ─────────────────────────────────────────
// @wailsio/runtime を動的インポートして、Web ビルド時に
// バンドルへ混入しないようにする（将来の web モード対応）。

function _wailsOn(name, callback) {
  let off = null
  import('@wailsio/runtime').then(({ Events }) => {
    off = Events.On(name, e => callback(e.data))
  })
  // 購読解除: off が確定する前に呼ばれる場合も考慮してラップ
  return () => { if (off) off() }
}

// ── 公開 API ─────────────────────────────────────────────

/**
 * アプリイベントを購読する。
 *
 * @param {string}   name     - イベント名（例: 'queue:changed'）
 * @param {Function} callback - コールバック。引数は送信された data の値。
 * @returns {Function} 購読解除関数（useEffect の cleanup に渡す）
 */
export function onAppEvent(name, callback) {
  if (isWails()) {
    return _wailsOn(name, callback)
  }
  return _sseOn(name, callback)
}
