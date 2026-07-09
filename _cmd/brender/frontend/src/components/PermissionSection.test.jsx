import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithI18n } from '../test/helpers'
import PermissionSection from './PermissionSection'

vi.mock('../lib/api/_client', () => ({
  isWails: vi.fn().mockReturnValue(false),
}))

vi.mock('../lib/api', () => ({
  ProjectApi: {
    listPermissions: vi.fn().mockResolvedValue([
      { target_id: 'usr_owner', target_name: 'Owner', role: 'owner', target_is_system: true },
      { target_id: 'usr_1', target_name: 'User1', role: 'viewer', target_is_system: false },
    ]),
    setPermission: vi.fn().mockResolvedValue(null),
    removePermission: vi.fn().mockResolvedValue(null),
    listFilePermissions: vi.fn().mockResolvedValue([]),
    setFilePermission: vi.fn().mockResolvedValue(null),
    removeFilePermission: vi.fn().mockResolvedValue(null),
  },
  AuthApi: {
    listUsers: vi.fn().mockResolvedValue([
      { id: 'usr_2', display_name: 'User2', is_system: false },
    ]),
    listGroups: vi.fn().mockResolvedValue([
      { id: 'grp_1', name: 'Group1', is_system: false },
    ]),
  },
  EnvironmentApi: {
    get: vi.fn().mockResolvedValue({ server: true, server_auth: true }),
  },
}))

vi.mock('../lib/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  useMessage: () => ({ showError: vi.fn(), clearError: vi.fn(), error: null }),
}))

beforeEach(() => { vi.clearAllMocks() })

describe('PermissionSection', () => {
  it('renders collapsed by default in browser mode', async () => {
    await renderWithI18n(<PermissionSection mode="project" resourceID="p1" />)
    expect(screen.getByText(/Permissions/)).toBeInTheDocument()
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
  })

  it('expands and loads permissions on click', async () => {
    await renderWithI18n(<PermissionSection mode="project" resourceID="p1" />)
    await userEvent.click(screen.getByText(/Permissions/))

    await waitFor(() => {
      expect(screen.getByText('User1')).toBeInTheDocument()
      expect(screen.getByText('Target')).toBeInTheDocument()
      expect(screen.getByText('Role')).toBeInTheDocument()
    })
  })

  it('disables role select for usr_owner', async () => {
    await renderWithI18n(<PermissionSection mode="project" resourceID="p1" />)
    await userEvent.click(screen.getByText(/Permissions/))

    await waitFor(() => {
      expect(screen.getByText('User1')).toBeInTheDocument()
    })
    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toBeDisabled()
  })

  it('does not show delete button for usr_owner', async () => {
    await renderWithI18n(<PermissionSection mode="project" resourceID="p1" />)
    await userEvent.click(screen.getByText(/Permissions/))

    await waitFor(() => {
      expect(screen.getByText('User1')).toBeInTheDocument()
    })
    const deleteBtns = screen.getAllByTitle('Delete')
    expect(deleteBtns).toHaveLength(1)
  })

  it('shows add button', async () => {
    await renderWithI18n(<PermissionSection mode="project" resourceID="p1" />)
    await userEvent.click(screen.getByText(/Permissions/))

    await waitFor(() => {
      expect(screen.getByText('User1')).toBeInTheDocument()
    })
    expect(screen.getByText('Add')).toBeInTheDocument()
  })
})
