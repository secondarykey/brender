const svc = () => import('../../../bindings/main/services/codes');

export const CodesApi = {
  getImageFormats: () =>
    svc().then(s => s.GetImageFormats()),

  getVideoFormats: () =>
    svc().then(s => s.GetVideoFormats()),

  getResolutionPresets: () =>
    svc().then(s => s.GetResolutionPresets()),

  saveImageFormats: (items) =>
    svc().then(s => s.SaveImageFormats(items)),

  saveVideoFormats: (items) =>
    svc().then(s => s.SaveVideoFormats(items)),

  saveResolutionPresets: (items) =>
    svc().then(s => s.SaveResolutionPresets(items)),

  generateID: () =>
    svc().then(s => s.GenerateID()),

  resetImageFormats: () =>
    svc().then(s => s.ResetImageFormats()),

  resetVideoFormats: () =>
    svc().then(s => s.ResetVideoFormats()),

  resetResolutionPresets: () =>
    svc().then(s => s.ResetResolutionPresets()),
}
