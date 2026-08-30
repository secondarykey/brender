package model

import (
	"time"

	"golang.org/x/xerrors"
)

// FileFavorite はユーザごとのファイルお気に入り登録。
// サーバモードでは操作ユーザ単位、デスクトップでは常に owner 単位となる。
type FileFavorite struct {
	UserID        string     `gorm:"primaryKey" json:"user_id"`
	ProjectFileID string     `gorm:"primaryKey" json:"project_file_id"`
	CreatedAt     *time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func AddFavorite(userID, projectFileID string) error {
	fav := &FileFavorite{UserID: userID, ProjectFileID: projectFileID}
	res := db.Where("user_id = ? AND project_file_id = ?", userID, projectFileID).FirstOrCreate(fav)
	if res.Error != nil {
		return xerrors.Errorf("AddFavorite: %w", res.Error)
	}
	return nil
}

func RemoveFavorite(userID, projectFileID string) error {
	if res := db.Where("user_id = ? AND project_file_id = ?", userID, projectFileID).Delete(&FileFavorite{}); res.Error != nil {
		return xerrors.Errorf("RemoveFavorite: %w", res.Error)
	}
	return nil
}

func IsFavorite(userID, projectFileID string) (bool, error) {
	var count int64
	res := db.Model(&FileFavorite{}).
		Where("user_id = ? AND project_file_id = ?", userID, projectFileID).
		Count(&count)
	if res.Error != nil {
		return false, xerrors.Errorf("IsFavorite: %w", res.Error)
	}
	return count > 0, nil
}

// ListFavoriteFileIDs は削除済みファイルを除いたお気に入りファイルIDを返す。
func ListFavoriteFileIDs(userID string) ([]string, error) {
	ids := []string{}
	res := db.Model(&FileFavorite{}).
		Select("file_favorites.project_file_id").
		Joins("INNER JOIN project_files ON project_files.id = file_favorites.project_file_id").
		Where("file_favorites.user_id = ? AND project_files.deleted_at IS NULL", userID).
		Order("file_favorites.created_at desc").
		Pluck("file_favorites.project_file_id", &ids)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListFavoriteFileIDs: %w", res.Error)
	}
	return ids, nil
}

func CountFavorites(userID string) (int64, error) {
	var count int64
	res := db.Model(&FileFavorite{}).
		Joins("INNER JOIN project_files ON project_files.id = file_favorites.project_file_id").
		Where("file_favorites.user_id = ? AND project_files.deleted_at IS NULL", userID).
		Count(&count)
	if res.Error != nil {
		return 0, xerrors.Errorf("CountFavorites: %w", res.Error)
	}
	return count, nil
}

// markFavorites は検索結果に IsFavorite を付与する。
func markFavorites(userID string, files []*FileSearchResult) error {
	if len(files) == 0 {
		return nil
	}
	fileIDs := make([]string, 0, len(files))
	for _, f := range files {
		fileIDs = append(fileIDs, f.ID)
	}
	var favIDs []string
	res := db.Model(&FileFavorite{}).
		Where("user_id = ? AND project_file_id IN ?", userID, fileIDs).
		Pluck("project_file_id", &favIDs)
	if res.Error != nil {
		return xerrors.Errorf("markFavorites: %w", res.Error)
	}
	set := make(map[string]struct{}, len(favIDs))
	for _, id := range favIDs {
		set[id] = struct{}{}
	}
	for _, f := range files {
		_, f.IsFavorite = set[f.ID]
	}
	return nil
}

// ── カスケード削除 ───────────────────────────────────────

func DeleteFavoritesByFile(projectFileID string) error {
	if res := db.Where("project_file_id = ?", projectFileID).Delete(&FileFavorite{}); res.Error != nil {
		return xerrors.Errorf("DeleteFavoritesByFile: %w", res.Error)
	}
	return nil
}

func DeleteFavoritesByProject(projectID string) error {
	subQuery := db.Model(&ProjectFile{}).Select("id").Where("project_id = ?", projectID)
	if res := db.Where("project_file_id IN (?)", subQuery).Delete(&FileFavorite{}); res.Error != nil {
		return xerrors.Errorf("DeleteFavoritesByProject: %w", res.Error)
	}
	return nil
}
