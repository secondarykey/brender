import { useState } from 'react'
import { QueueApi } from '../../../lib/api'
import { isWails } from '../../../lib/api/_client'
import Dialog from '../../../components/Dialog'
import MoviePlayer from '../../../components/MoviePlayer'

const basename = p => p.replace(/\\/g, '/').split('/').pop()

// 出力の動画を再生する。ウィンドウでは別ウィンドウで開き、ブラウザでは画面の中のダイアログで開く。
//   const [playMovie, movieDialog] = useMoviePlayer()
//   playMovie(path) で開き、movieDialog を画面のどこかに置いておく
export function useMoviePlayer() {
  const [path, setPath] = useState('')

  const play = (p) => {
    if (!p) return
    if (isWails()) {
      QueueApi.openMovieWindow({ path: p })
    } else {
      setPath(p)
    }
  }

  const dialog = (
    <Dialog
      open={!!path}
      title={path ? basename(path) : ''}
      onClose={() => setPath('')}
      wide
      bodyClassName="movie-player-dialog-body"
    >
      {path && <MoviePlayer moviePath={path} />}
    </Dialog>
  )

  return [play, dialog]
}
