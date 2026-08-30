package services

import (
	"github.com/ikascrew/brender/api"
)

type Favorite struct{}

func NewFavorite() *Favorite { return &Favorite{} }

func (f *Favorite) SetFavorite(fileID string, favorite bool) (bool, error) {
	return api.SetFavorite(api.WailsContext(), fileID, favorite)
}

func (f *Favorite) ToggleFavorite(fileID string) (bool, error) {
	return api.ToggleFavorite(api.WailsContext(), fileID)
}

func (f *Favorite) IsFavorite(fileID string) (bool, error) {
	return api.IsFavorite(api.WailsContext(), fileID)
}

func (f *Favorite) ListFavoriteIDs() ([]string, error) {
	return api.ListFavoriteIDs(api.WailsContext())
}

func (f *Favorite) CountFavorites() (int64, error) {
	return api.CountFavorites(api.WailsContext())
}
