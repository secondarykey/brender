import { isWails, serverCall } from './_client'

const svc = () => import('../../../bindings/main/services/favorite')

export const FavoriteApi = {
  set: ({ fileID, favorite }) =>
    isWails() ? svc().then(s => s.SetFavorite(fileID, !!favorite))
              : serverCall('favorite', 'set', { file_id: fileID, favorite: !!favorite }),

  toggle: ({ fileID }) =>
    isWails() ? svc().then(s => s.ToggleFavorite(fileID))
              : serverCall('favorite', 'toggle', { file_id: fileID }),

  isFavorite: ({ fileID }) =>
    isWails() ? svc().then(s => s.IsFavorite(fileID))
              : serverCall('favorite', 'is_favorite', { file_id: fileID }),

  listIDs: () =>
    isWails() ? svc().then(s => s.ListFavoriteIDs())
              : serverCall('favorite', 'list_ids'),

  count: () =>
    isWails() ? svc().then(s => s.CountFavorites())
              : serverCall('favorite', 'count'),
}
