import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import JobDetailDialog from './JobDetailDialog'

vi.mock('../lib/api', () => ({
  QueueApi: {
    lockJob: vi.fn().mockResolvedValue(null),
    unlockJob: vi.fn().mockResolvedValue(null),
    deleteJob: vi.fn().mockResolvedValue(null),
    openLogWindow: vi.fn().mockResolvedValue(null),
  },
  ProjectApi: {
    getFile: vi.fn().mockResolvedValue({ my_role: 'owner' }),
  },
}))

vi.mock('../lib/dateFormat', () => ({
  formatDateFull: (v) => v ? 'formatted-date' : '—',
}))

beforeEach(() => { vi.clearAllMocks() })

const mockJob = {
  id: 'j1',
  name: 'Test Job',
  status: 'completed',
  project_file_id: 'f1',
  blender_path: 'C:/blender.exe',
  blender_file: 'test.blend',
  scene: 'Scene1',
  engine: 'CYCLES',
  start_frame: 1,
  end_frame: 100,
  frame_step: 1,
  thread: 0,
  samples: 128,
  resolution_x: 1920,
  resolution_y: 1080,
  data_status: 2,
  started_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T01:00:00Z',
  enqueued_at: '2024-01-01T00:00:00Z',
}

describe('JobDetailDialog', () => {
  it('renders nothing when job is null', async () => {
    const { container } = await renderWithI18n(
      <JobDetailDialog job={null} onClose={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders job details', async () => {
    await renderWithI18n(
      <JobDetailDialog job={mockJob} onClose={() => {}} />
    )
    expect(screen.getByText('Job Details')).toBeInTheDocument()
    expect(screen.getByText('C:/blender.exe')).toBeInTheDocument()
    expect(screen.getByText('test.blend')).toBeInTheDocument()
    expect(screen.getByText('CYCLES')).toBeInTheDocument()
    expect(screen.getByText('1920×1080')).toBeInTheDocument()
  })

  it('shows status badge', async () => {
    await renderWithI18n(
      <JobDetailDialog job={mockJob} onClose={() => {}} />
    )
    const badge = document.querySelector('.status-badge.status-completed')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('Completed')
  })

  it('shows data status badge', async () => {
    await renderWithI18n(
      <JobDetailDialog job={mockJob} onClose={() => {}} />
    )
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('calls lockJob when lock button clicked', async () => {
    const { QueueApi } = await import('../lib/api')
    const onStatusChanged = vi.fn()
    await renderWithI18n(
      <JobDetailDialog job={mockJob} onClose={() => {}} onStatusChanged={onStatusChanged} />
    )

    await waitFor(() => expect(screen.getByText('Lock')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Lock'))

    await waitFor(() => {
      expect(QueueApi.lockJob).toHaveBeenCalledWith({ id: 'j1' })
      expect(onStatusChanged).toHaveBeenCalledWith('j1', 3)
    })
  })

  it('opens delete confirm dialog', async () => {
    await renderWithI18n(
      <JobDetailDialog job={mockJob} onClose={() => {}} />
    )
    await waitFor(() => {
      const deleteBtn = screen.getAllByText('Delete')[0]
      expect(deleteBtn).not.toBeDisabled()
    })
    await userEvent.click(screen.getAllByText('Delete')[0])
    await waitFor(() => {
      expect(screen.getByText('Delete this job?')).toBeInTheDocument()
    })
  })

  it('disables delete for locked jobs', async () => {
    const lockedJob = { ...mockJob, data_status: 3 }
    await renderWithI18n(
      <JobDetailDialog job={lockedJob} onClose={() => {}} />
    )
    await waitFor(() => {
      const deleteBtn = screen.getAllByText('Delete')[0]
      expect(deleteBtn).toBeDisabled()
    })
  })
})
