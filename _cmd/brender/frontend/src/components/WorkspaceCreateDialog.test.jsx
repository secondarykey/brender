import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import WorkspaceCreateDialog from './WorkspaceCreateDialog'

vi.mock('../lib/api', () => ({
  BlenderApi: {
    getToolData: vi.fn().mockResolvedValue({
      Scenes: [{ Name: 'Scene1' }, { Name: 'Scene2' }],
      Cameras: [{ Name: 'Camera1' }],
    }),
    getEngines: vi.fn().mockResolvedValue(['CYCLES', 'BLENDER_EEVEE']),
  },
  WorkspaceApi: {
    createBatch: vi.fn().mockResolvedValue([{ id: 'ws1' }]),
  },
}))

beforeEach(() => { vi.clearAllMocks() })

describe('WorkspaceCreateDialog', () => {
  it('renders nothing when closed', async () => {
    const { container } = await renderWithI18n(
      <WorkspaceCreateDialog open={false} onClose={() => {}} projectID="p1" fileID="f1" fileName="test.blend" onCreated={() => {}} />
    )
    expect(container.querySelector('.dialog-overlay')).not.toBeInTheDocument()
  })

  it('renders dialog when open', async () => {
    await renderWithI18n(
      <WorkspaceCreateDialog open onClose={() => {}} projectID="p1" fileID="f1" fileName="test.blend" onCreated={() => {}} />
    )
    expect(screen.getByText('Create Workspace')).toBeInTheDocument()
  })

  it('fetches tool data and engines on open', async () => {
    const { BlenderApi } = await import('../lib/api')
    await renderWithI18n(
      <WorkspaceCreateDialog open onClose={() => {}} projectID="p1" fileID="f1" fileName="test.blend" onCreated={() => {}} />
    )
    await waitFor(() => {
      expect(BlenderApi.getToolData).toHaveBeenCalledWith({ installID: 0, fileID: 'f1' })
      expect(BlenderApi.getEngines).toHaveBeenCalledWith({ installID: 0 })
    })
  })

  it('creates single workspace by default', async () => {
    const { WorkspaceApi } = await import('../lib/api')
    const onCreated = vi.fn()
    await renderWithI18n(
      <WorkspaceCreateDialog open onClose={() => {}} projectID="p1" fileID="f1" fileName="test.blend" onCreated={onCreated} />
    )
    await waitFor(() => expect(screen.getByText('Create (1)')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Create (1)'))
    await waitFor(() => {
      expect(WorkspaceApi.createBatch).toHaveBeenCalledWith({
        projectID: 'p1',
        projectFileID: 'f1',
        specs: [{ Name: 'New Workspace', Scene: '', Camera: '', Engine: '' }],
      })
      expect(onCreated).toHaveBeenCalled()
    })
  })

  it('shows multiple mode toggle', async () => {
    await renderWithI18n(
      <WorkspaceCreateDialog open onClose={() => {}} projectID="p1" fileID="f1" fileName="test.blend" onCreated={() => {}} />
    )
    expect(screen.getByText('Create multiple')).toBeInTheDocument()
  })

  it('calls onClose on cancel', async () => {
    const onClose = vi.fn()
    await renderWithI18n(
      <WorkspaceCreateDialog open onClose={onClose} projectID="p1" fileID="f1" fileName="test.blend" onCreated={() => {}} />
    )
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
