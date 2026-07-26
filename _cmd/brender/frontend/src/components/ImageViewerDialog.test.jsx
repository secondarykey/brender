import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import ImageViewerDialog from './ImageViewerDialog'

vi.mock('../lib/api', () => ({
  QueueApi: {
    listJobImages: vi.fn().mockResolvedValue(['/output/frame_0001.png', '/output/frame_0002.png']),
    getImageBase64: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
  },
  WorkspaceApi: {
    setThumbnail: vi.fn().mockResolvedValue(null),
    createMovie: vi.fn().mockResolvedValue(null),
  },
}))

beforeEach(() => { vi.clearAllMocks() })

const mockJob = {
  id: 'j1',
  name: 'Test Job',
  project_id: 'p1',
  project_file_id: 'f1',
  workspace_id: 'ws1',
  workspace_name: 'WS1',
}

describe('ImageViewerDialog', () => {
  it('renders nothing when job is null', async () => {
    const { container } = await renderWithI18n(<ImageViewerDialog job={null} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('loads and displays images', async () => {
    await renderWithI18n(<ImageViewerDialog job={mockJob} onClose={() => {}} />)

    await waitFor(() => {
      const img = document.querySelector('.image-viewer-img')
      expect(img).toBeInTheDocument()
    })

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    const img = document.querySelector('.image-viewer-img')
    expect(img.src).toContain('data:image/png')
  })

  it('shows no images message when list is empty', async () => {
    const { QueueApi } = await import('../lib/api')
    QueueApi.listJobImages.mockResolvedValueOnce([])

    await renderWithI18n(<ImageViewerDialog job={mockJob} onClose={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('No images')).toBeInTheDocument()
    })
  })

  it('calls setThumbnail on button click', async () => {
    const { WorkspaceApi } = await import('../lib/api')
    await renderWithI18n(<ImageViewerDialog job={mockJob} onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('Set as Thumbnail')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Set as Thumbnail'))

    await waitFor(() => {
      expect(WorkspaceApi.setThumbnail).toHaveBeenCalledWith({
        projectID: 'p1',
        fileID: 'f1',
        workspaceID: 'ws1',
        imagePath: '/output/frame_0001.png',
      })
    })
  })
})
