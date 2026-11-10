import { describe, it, expect } from 'vitest'
import { renderWithI18n } from '../test/helpers'
import FieldLabel from './FieldLabel'

// ラベルは1行に収めて「…」で切るので、切れた分を読めるよう全文を title に持つ。
describe('FieldLabel', () => {
  it('添え書きが無ければラベルだけを title にする', async () => {
    const { container } = await renderWithI18n(<FieldLabel text="Blender" />)
    const label = container.querySelector('label.form-label-ellipsis')
    expect(label).toHaveAttribute('title', 'Blender')
    expect(container.querySelector('.form-default-tag')).not.toBeInTheDocument()
  })

  it('未設定時の値を添え、全文を title に入れる', async () => {
    const { container } = await renderWithI18n(<FieldLabel text="Blender" defaultValue="Blender 5.2" />)
    const tag = container.querySelector('.form-default-tag')
    expect(tag).toBeInTheDocument()
    expect(container.querySelector('label')).toHaveAttribute('title', `Blender ${tag.textContent}`)
    expect(tag.textContent).toContain('Blender 5.2')
  })

  it('固定値は未設定時の値より優先して出す', async () => {
    const { container } = await renderWithI18n(<FieldLabel text="Engine" defaultValue="EEVEE" lockedValue="CYCLES" />)
    expect(container.querySelector('.form-lock-tag')).toHaveTextContent('CYCLES')
    expect(container.querySelector('.form-default-tag')).not.toBeInTheDocument()
    expect(container.querySelector('label')).toHaveAttribute('title', 'Engine CYCLES')
  })
})
