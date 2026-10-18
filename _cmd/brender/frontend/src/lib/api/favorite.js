const svc = () => import('../../../bindings/main/services/favorite')

export const FavoriteApi = {
  set: ({ fileID, favorite }) =>
    svc().then(s => s.SetFavorite(fileID, !!favorite)),

  toggle: ({ fileID }) =>
    svc().then(s => s.ToggleFavorite(fileID)),

  isFavorite: ({ fileID }) =>
    svc().then(s => s.IsFavorite(fileID)),

  listIDs: () =>
    svc().then(s => s.ListFavoriteIDs()),

  count: () =>
    svc().then(s => s.CountFavorites()),
}
