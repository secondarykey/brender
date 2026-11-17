import { useState, useEffect, useRef } from 'react'
import { onAppEvent } from './appEvents'

/**
 * サムネイルを取得して返す。まだ無い間は queue:changed のたびに取り直す
 * （ファイル登録直後の Test 出力など、ジョブが終わってから画像ができるため）。
 * 一度取れたら thumbnail.jpg に保存されるので、以後は取り直さない。
 *
 *   const [src, setSrc] = useThumbnail(
 *     () => WorkspaceApi.getThumbnail({ projectID, fileID, workspaceID }),
 *     [projectID, fileID, workspaceID],
 *   )
 *
 * @param {() => Promise<string>|null} fetcher - 画像（データURI か URL）を返す。null を返すと取得しない
 * @param {Array} deps - 変わったら取り直す値
 * @returns {[string|null, (src: string|null) => void]} setSrc は画像を差し替えたとき用
 */
export function useThumbnail(fetcher, deps) {
  const [src, setSrcState] = useState(null)
  const srcRef = useRef(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const seqRef = useRef(0)

  const setSrc = (val) => {
    srcRef.current = val || null
    setSrcState(val || null)
  }

  const fetchThumb = () => {
    const p = fetcherRef.current()
    if (!p) return
    const seq = ++seqRef.current
    p.then(val => { if (seq === seqRef.current) setSrc(val) })
      .catch(() => {})
  }

  useEffect(() => {
    setSrc(null)
    fetchThumb()
    const off = onAppEvent('queue:changed', () => {
      if (!srcRef.current) fetchThumb()
    })
    return off
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return [src, setSrc]
}
