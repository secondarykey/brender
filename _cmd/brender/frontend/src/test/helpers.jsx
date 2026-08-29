import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

let _testI18n = null

export async function getTestI18n() {
  if (_testI18n) return _testI18n
  _testI18n = i18n.createInstance()
  await _testI18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: {
          common: {
            loading: 'Loading...',
            save: 'Save',
            saving: 'Saving...',
            cancel: 'Cancel',
            delete: 'Delete',
            deleting: 'Deleting...',
            close: 'Close',
            back: 'Back',
            default: 'Default',
            automatic: 'Automatic',
            note: 'Note',
            notePlaceholder: 'Write a note...',
            locked: 'Locked',
            unlock: 'Unlock',
            lock: 'Lock',
            holdToConfirm: 'Hold to confirm',
            loop: 'Loop',
            registering: 'Registering...',
            yes: 'Yes',
          },
          permission: {
            accessDenied: 'Access denied',
            title: 'Permissions',
            target: 'Target',
            role: 'Role',
            actions: 'Actions',
            noPermissions: 'No permissions',
            add: 'Add',
            addTitle: 'Add Permission',
            addAction: 'Add',
            user: 'User',
            group: 'Group',
            saved: 'Saved',
            removed: 'Removed',
            confirmRemove: 'Remove permission?',
            noTargets: 'No targets',
            roles: {
              owner: 'Owner',
              editor: 'Editor',
              file_register: 'File Register',
              viewer: 'Viewer',
              workspace_creator: 'Workspace Creator',
              runner: 'Runner',
            },
          },
          title: {
            minimum: 'Minimize',
            maximum: 'Maximize',
            close: 'Close',
            confirmClose: 'Close app?',
            closeAnyway: 'Close anyway',
            queueRunningWarning: 'Queue is running',
            serverRunningWarning: 'Server is running',
            alwaysOnTop: 'Always on top',
            download: 'Download',
          },
          sysmon: { memory: 'Memory' },
          breadcrumb: {
            projects: 'Projects',
            job: 'Job',
            jobResult: 'Job Result',
            backToFileList: '← File list',
            backToWorkspaceList: '← Workspace list',
          },
          status: {
            waiting: 'Waiting',
            running: 'Running',
            completed: 'Completed',
            error: 'Error',
            cancelled: 'Cancelled',
            recovering: 'Recovering',
            interrupted: 'Interrupted',
          },
          dataStatus: {
            none: 'None',
            available: 'Available',
            deleted: 'Deleted',
            corrupted: 'Corrupted',
          },
          pagination: {
            items: ' items',
            itemsPerPage: 'per page',
            page: 'page',
          },
          sort: {
            label: 'Sort',
            display_order: 'Display Order',
            name: 'Name',
            created_at: 'Created',
            processed_at: 'Processed',
            asc: 'Ascending',
            desc: 'Descending',
          },
          dialog: {
            jobDetails: 'Job Details',
            status: 'Status',
            data: 'Data',
            jobName: 'Job Name',
            blender: 'Blender',
            file: 'File',
            scene: 'Scene',
            camera: 'Camera',
            engine: 'Engine',
            frames: 'Frames',
            threads: 'Threads',
            samples: 'Samples',
            resolution: 'Resolution',
            enrolledAt: 'Enrolled',
            startedAt: 'Started',
            completedAt: 'Completed',
            duration: 'Duration',
            renderResults: 'Render Results: ',
            step: 'step ',
          },
          job: {
            showLog: 'Show Log',
            deleteWarning: 'Delete this job?',
          },
          time: {
            seconds: 's',
            minutes: 'm',
            hours: 'h',
          },
          viewer: {
            play: 'Play',
            stop: 'Stop',
            noImages: 'No images',
            setAsThumbnail: 'Set as Thumbnail',
            thumbnailSet: 'Thumbnail set',
            createMovie: 'Create Movie',
            movieCreated: 'Movie created',
          },
          tag: {
            addTag: 'Add tag...',
          },
          workspace: {
            createDialog: {
              title: 'Create Workspace',
              multipleFromFile: 'Create multiple',
              engines: 'Engines',
              scenes: 'Scenes',
              cameras: 'Cameras',
              createCount: 'Create ({{count}})',
            },
          },
          settings: {
            logLevel: 'Log Level',
          },
          users: {
            systemBadge: 'System',
          },
        },
      },
    },
    lng: 'en',
    interpolation: { escapeValue: false },
  })
  return _testI18n
}

export async function renderWithI18n(ui) {
  const i18nInstance = await getTestI18n()
  return render(
    <I18nextProvider i18n={i18nInstance}>
      {ui}
    </I18nextProvider>
  )
}
