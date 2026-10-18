package services

import (
	"context"
	"github.com/secondarykey/brender/api"
)

type Favorite struct{}

func NewFavorite() *Favorite { return &Favorite{} }

func (f *Favorite) SetFavorite(ctx context.Context, fileID string, favorite bool) (bool, error) {
	return api.SetFavorite(ctx, fileID, favorite)
}

func (f *Favorite) ToggleFavorite(ctx context.Context, fileID string) (bool, error) {
	return api.ToggleFavorite(ctx, fileID)
}

func (f *Favorite) IsFavorite(ctx context.Context, fileID string) (bool, error) {
	return api.IsFavorite(ctx, fileID)
}

func (f *Favorite) ListFavoriteIDs(ctx context.Context) ([]string, error) {
	return api.ListFavoriteIDs(ctx)
}

func (f *Favorite) CountFavorites(ctx context.Context) (int64, error) {
	return api.CountFavorites(ctx)
}
