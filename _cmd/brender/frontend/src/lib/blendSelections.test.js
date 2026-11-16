import { describe, it, expect } from 'vitest'
import { checkSavedSelections } from './blendSelections'

const LISTS = {
  scenes: ['Scene', 'Night'],
  cameras: [
    { Name: 'Cam', Scenes: ['Scene'] },
    { Name: 'NightCam', Scenes: ['Night'] },
  ],
  engines: ['CYCLES', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'],
}

describe('checkSavedSelections', () => {
  it('どれも一覧にあれば何も変えない', () => {
    const r = checkSavedSelections({ scene: 'Scene', camera: 'Cam', engine: 'CYCLES' }, LISTS)
    expect(r).toMatchObject({ scene: 'Scene', camera: 'Cam', engine: 'CYCLES', warned: false })
  })

  it('未設定（空）は確かめない', () => {
    const r = checkSavedSelections({ scene: '', camera: '', engine: '' }, LISTS)
    expect(r.warned).toBe(false)
  })

  it('シーンが無くなったらカメラも空にする', () => {
    const r = checkSavedSelections({ scene: 'Gone', camera: 'Cam', engine: '' }, LISTS)
    expect(r).toMatchObject({ scene: '', camera: '', missingScene: 'Gone', missingCamera: 'Cam', warned: true })
  })

  it('カメラは保存してあるシーンにあるかで見る', () => {
    const r = checkSavedSelections({ scene: 'Scene', camera: 'NightCam', engine: '' }, LISTS)
    expect(r).toMatchObject({ scene: 'Scene', camera: '', missingCamera: 'NightCam' })
  })

  it('エンジンの名前が変わっただけなら置き換える', () => {
    const r = checkSavedSelections({ scene: '', camera: '', engine: 'BLENDER_EEVEE' }, LISTS)
    expect(r).toMatchObject({ engine: 'BLENDER_EEVEE_NEXT', missingEngine: '', convertedEngine: { from: 'BLENDER_EEVEE', to: 'BLENDER_EEVEE_NEXT' }, warned: true })
  })

  it('置き換え先が決まらないエンジンは空にする', () => {
    const r = checkSavedSelections({ scene: '', camera: '', engine: 'OCTANE' }, LISTS)
    expect(r).toMatchObject({ engine: '', missingEngine: 'OCTANE', convertedEngine: null })
  })

  it('一覧がまだ無い項目は確かめない', () => {
    const r = checkSavedSelections({ scene: 'Gone', camera: 'Cam', engine: 'OCTANE' }, {})
    expect(r).toMatchObject({ scene: 'Gone', camera: 'Cam', engine: 'OCTANE', warned: false })
  })
})
