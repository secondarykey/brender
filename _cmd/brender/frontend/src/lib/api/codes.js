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
}
