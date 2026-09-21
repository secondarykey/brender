package api

import (
	"context"

	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// ファイルのお気に入り。登録は操作ユーザ単位で保持する
// （サーバモードでは各ユーザ、デスクトップでは常に owner）。
// 参照できないファイルをお気に入りにはできないため、参照権限のみ要求する。

func AddFavorite(ctx context.Context, fileID string) error {
	if fileID == "" {
		return xerrors.New("file id is required")
	}
	if err := requireFileAccess(ctx, fileID); err != nil {
		return err
	}
	return model.AddFavorite(currentUser(ctx), fileID)
}

func RemoveFavorite(ctx context.Context, fileID string) error {
	if fileID == "" {
		return xerrors.New("file id is required")
	}
	return model.RemoveFavorite(currentUser(ctx), fileID)
}

// SetFavorite はお気に入り状態を設定し、設定後の状態を返す。
func SetFavorite(ctx context.Context, fileID string, favorite bool) (bool, error) {
	if favorite {
		if err := AddFavorite(ctx, fileID); err != nil {
			return false, err
		}
		return true, nil
	}
	if err := RemoveFavorite(ctx, fileID); err != nil {
		return false, err
	}
	return false, nil
}

// ToggleFavorite はお気に入り状態を反転し、反転後の状態を返す。
func ToggleFavorite(ctx context.Context, fileID string) (bool, error) {
	cur, err := IsFavorite(ctx, fileID)
	if err != nil {
		return false, err
	}
	return SetFavorite(ctx, fileID, !cur)
}

func IsFavorite(ctx context.Context, fileID string) (bool, error) {
	if fileID == "" {
		return false, nil
	}
	return model.IsFavorite(currentUser(ctx), fileID)
}

// ListFavoriteIDs は操作ユーザのお気に入りファイルIDを返す。
// 一覧画面で星の状態をまとめて解決するために使う。
func ListFavoriteIDs(ctx context.Context) ([]string, error) {
	return model.ListFavoriteFileIDs(currentUser(ctx))
}

func CountFavorites(ctx context.Context) (int64, error) {
	return model.CountFavorites(currentUser(ctx))
}
