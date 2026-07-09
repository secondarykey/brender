import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MoviePlayer from './MoviePlayer'

describe('MoviePlayer', () => {
  it('renders video element with correct src', () => {
    render(<MoviePlayer moviePath="/path/to/movie.mp4" />)
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video.src).toContain('/_movie?path=%2Fpath%2Fto%2Fmovie.mp4')
    expect(video.autoplay).toBe(true)
    expect(video.loop).toBe(true)
  })

  it('does not show info overlay initially (no metadata loaded)', () => {
    render(<MoviePlayer moviePath="/test.mp4" showInfo />)
    expect(document.querySelector('.movie-info-overlay')).not.toBeInTheDocument()
  })

  it('hides info overlay when showInfo is false', () => {
    render(<MoviePlayer moviePath="/test.mp4" showInfo={false} />)
    expect(document.querySelector('.movie-info-overlay')).not.toBeInTheDocument()
  })
})
