import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithI18n } from '../test/helpers'
import RenderConfirmDialog from './RenderConfirmDialog'

const PREVIEW = {
  scene: 'Scene', engine: 'CYCLES', camera: 'Cam',
  start_frame: 1, end_frame: 10, frame_step: 1, samples: 64,
  resolution_x: 1920, resolution_y: 1080, output_format: 'PNG',
}

describe('RenderConfirmDialog', () => {
  it('preview が無ければ出さない', async () => {
    await renderWithI18n(<RenderConfirmDialog preview={null} onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByText('render.confirmTitle')).not.toBeInTheDocument()
  })

  it('.blend が前回から変わっていなければ警告し、前回の値を添える', async () => {
    const pv = { ...PREVIEW, file_not_modified: true, previous: { ...PREVIEW, samples: 32 } }
    const { container } = await renderWithI18n(<RenderConfirmDialog preview={pv} onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('render.fileNotModifiedWarning')).toBeInTheDocument()
    // サンプル数だけ違うので「同じ設定」の警告は出さない
    expect(screen.queryByText('render.identicalRenderWarning')).not.toBeInTheDocument()
    expect(container.querySelector('.dialog-prev-changed')).toHaveTextContent('32')
  })

  it('前回とまったく同じ設定なら、同じレンダリングになる警告も出す', async () => {
    const pv = { ...PREVIEW, file_not_modified: true, previous: { ...PREVIEW } }
    const { container } = await renderWithI18n(<RenderConfirmDialog preview={pv} onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByText('render.identicalRenderWarning')).toBeInTheDocument()
    expect(container.querySelector('.dialog-prev-changed')).not.toBeInTheDocument()
  })

  it('.blend が変わっていれば前回の値は出さない', async () => {
    const pv = { ...PREVIEW, file_not_modified: false, previous: { ...PREVIEW, samples: 32 } }
    const { container } = await renderWithI18n(<RenderConfirmDialog preview={pv} onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByText('render.fileNotModifiedWarning')).not.toBeInTheDocument()
    expect(container.querySelector('.dialog-prev, .dialog-prev-changed')).not.toBeInTheDocument()
  })

  it('ワークスペース名を渡すと行を出し、実行で onConfirm を呼ぶ', async () => {
    const onConfirm = vi.fn()
    await renderWithI18n(<RenderConfirmDialog preview={PREVIEW} workspaceName="WS1" onCancel={() => {}} onConfirm={onConfirm} />)
    expect(screen.getByText('WS1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /common\.run/ }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
