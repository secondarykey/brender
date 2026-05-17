import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/github.com/ikascrew/brender/api/wails/codes');

export const CodesApi = {
  getImageFormats: () =>
    isWails() ? svc().then(s => s.GetImageFormats())
              : serverCall('codes', 'get_image_formats'),

  getVideoFormats: () =>
    isWails() ? svc().then(s => s.GetVideoFormats())
              : serverCall('codes', 'get_video_formats'),

  getResolutionPresets: () =>
    isWails() ? svc().then(s => s.GetResolutionPresets())
              : serverCall('codes', 'get_resolution_presets'),

  saveImageFormats: (items) =>
    isWails() ? svc().then(s => s.SaveImageFormats(items))
              : serverCall('codes', 'save_image_formats', { items }),

  saveVideoFormats: (items) =>
    isWails() ? svc().then(s => s.SaveVideoFormats(items))
              : serverCall('codes', 'save_video_formats', { items }),

  saveResolutionPresets: (items) =>
    isWails() ? svc().then(s => s.SaveResolutionPresets(items))
              : serverCall('codes', 'save_resolution_presets', { items }),

  generateID: () =>
    isWails() ? svc().then(s => s.GenerateID())
              : serverCall('codes', 'generate_id'),

  resetImageFormats: () =>
    isWails() ? svc().then(s => s.ResetImageFormats())
              : serverCall('codes', 'reset_image_formats'),

  resetVideoFormats: () =>
    isWails() ? svc().then(s => s.ResetVideoFormats())
              : serverCall('codes', 'reset_video_formats'),

  resetResolutionPresets: () =>
    isWails() ? svc().then(s => s.ResetResolutionPresets())
              : serverCall('codes', 'reset_resolution_presets'),
}
