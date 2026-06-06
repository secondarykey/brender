package model

import (
	"golang.org/x/xerrors"
)

// 権限ロール
const (
	RoleOwner  = "owner"
	RoleRunner = "runner"
	RoleEditor = "editor"
	RoleViewer = "viewer"
)

// AllRoles は有効なロール一覧。
var AllRoles = []string{RoleOwner, RoleRunner, RoleEditor, RoleViewer}

// ProjectPermission はプロジェクトに対するユーザ/グループの権限。
// TargetID は usr_* または grp_* のいずれか。
type ProjectPermission struct {
	ProjectID string `gorm:"primaryKey" json:"project_id"`
	TargetID  string `gorm:"primaryKey" json:"target_id"` // usr_* or grp_*
	Role      string `json:"role"`                         // owner, runner, editor, viewer
	MetaFields `gorm:"embedded"`
}

// ── CRUD ──────────────────────────────────────────────────

// SetProjectPermission は権限を設定する（存在すれば上書き）。
func SetProjectPermission(projectID, targetID, role string) error {
	perm := ProjectPermission{
		ProjectID: projectID,
		TargetID:  targetID,
		Role:      role,
	}
	// Upsert: 既存なら role を更新、なければ作成
	res := db.Where("project_id = ? AND target_id = ?", projectID, targetID).
		Assign(ProjectPermission{Role: role}).
		FirstOrCreate(&perm)
	if res.Error != nil {
		return xerrors.Errorf("SetProjectPermission: %w", res.Error)
	}
	// FirstOrCreate で見つかった場合は role が古いままなので Save
	if perm.Role != role {
		perm.Role = role
		if res := db.Save(&perm); res.Error != nil {
			return xerrors.Errorf("SetProjectPermission save: %w", res.Error)
		}
	}
	return nil
}

// RemoveProjectPermission は権限を削除する。
func RemoveProjectPermission(projectID, targetID string) error {
	if res := db.Where("project_id = ? AND target_id = ?", projectID, targetID).
		Delete(&ProjectPermission{}); res.Error != nil {
		return xerrors.Errorf("RemoveProjectPermission: %w", res.Error)
	}
	return nil
}

// ListProjectPermissions はプロジェクトの全権限を返す。
func ListProjectPermissions(projectID string) ([]*ProjectPermission, error) {
	var perms []*ProjectPermission
	if res := db.Where("project_id = ?", projectID).
		Order("role asc, target_id asc").Find(&perms); res.Error != nil {
		return nil, xerrors.Errorf("ListProjectPermissions: %w", res.Error)
	}
	return perms, nil
}

// DeleteProjectPermissions はプロジェクトの全権限を削除する（プロジェクト削除時用）。
func DeleteProjectPermissions(projectID string) error {
	if res := db.Where("project_id = ?", projectID).Delete(&ProjectPermission{}); res.Error != nil {
		return xerrors.Errorf("DeleteProjectPermissions: %w", res.Error)
	}
	return nil
}

// ── 権限判定 ──────────────────────────────────────────────

// collectTargetIDs はユーザが持つ全ターゲットID（自分 + 所属グループ + grp_all）を返す。
func collectTargetIDs(userID string) ([]string, error) {
	ids := []string{userID, GroupIDAll}

	// 明示的なグループ所属を取得
	var ugs []UserGroup
	if res := db.Where("user_id = ?", userID).Find(&ugs); res.Error != nil {
		return nil, xerrors.Errorf("collectTargetIDs: %w", res.Error)
	}
	for _, ug := range ugs {
		if ug.GroupID != GroupIDAll {
			ids = append(ids, ug.GroupID)
		}
	}
	return ids, nil
}

// HasProjectAccess はユーザがプロジェクトに対していずれかの権限を持つか判定する。
func HasProjectAccess(projectID, userID string) (bool, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return false, err
	}
	var count int64
	if res := db.Model(&ProjectPermission{}).
		Where("project_id = ? AND target_id IN ?", projectID, ids).
		Count(&count); res.Error != nil {
		return false, xerrors.Errorf("HasProjectAccess: %w", res.Error)
	}
	return count > 0, nil
}

// HasProjectRole はユーザが指定ロールのいずれかを持つか判定する。
func HasProjectRole(projectID, userID string, roles []string) (bool, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return false, err
	}
	var count int64
	if res := db.Model(&ProjectPermission{}).
		Where("project_id = ? AND target_id IN ? AND role IN ?", projectID, ids, roles).
		Count(&count); res.Error != nil {
		return false, xerrors.Errorf("HasProjectRole: %w", res.Error)
	}
	return count > 0, nil
}

// GetUserProjectRole はユーザのプロジェクトでの最上位ロールを返す。
// 権限がない場合は空文字を返す。
func GetUserProjectRole(projectID, userID string) (string, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return "", err
	}
	var perms []ProjectPermission
	if res := db.Where("project_id = ? AND target_id IN ?", projectID, ids).
		Find(&perms); res.Error != nil {
		return "", xerrors.Errorf("GetUserProjectRole: %w", res.Error)
	}
	// 優先順位: owner > runner > editor > viewer
	priority := map[string]int{RoleOwner: 4, RoleRunner: 3, RoleEditor: 2, RoleViewer: 1}
	best := ""
	bestP := 0
	for _, p := range perms {
		if priority[p.Role] > bestP {
			best = p.Role
			bestP = priority[p.Role]
		}
	}
	return best, nil
}

// ══════════════════════════════════════════════════════════
// FilePermission — ファイル単位の権限
// ══════════════════════════════════════════════════════════

type FilePermission struct {
	FileID   string `gorm:"primaryKey" json:"file_id"`
	TargetID string `gorm:"primaryKey" json:"target_id"` // usr_* or grp_*
	Role     string `json:"role"`                         // owner, runner, editor, viewer
	MetaFields `gorm:"embedded"`
}

// ── CRUD ──────────────────────────────────────────────────

func SetFilePermission(fileID, targetID, role string) error {
	perm := FilePermission{
		FileID:   fileID,
		TargetID: targetID,
		Role:     role,
	}
	res := db.Where("file_id = ? AND target_id = ?", fileID, targetID).
		Assign(FilePermission{Role: role}).
		FirstOrCreate(&perm)
	if res.Error != nil {
		return xerrors.Errorf("SetFilePermission: %w", res.Error)
	}
	if perm.Role != role {
		perm.Role = role
		if res := db.Save(&perm); res.Error != nil {
			return xerrors.Errorf("SetFilePermission save: %w", res.Error)
		}
	}
	return nil
}

func RemoveFilePermission(fileID, targetID string) error {
	if res := db.Where("file_id = ? AND target_id = ?", fileID, targetID).
		Delete(&FilePermission{}); res.Error != nil {
		return xerrors.Errorf("RemoveFilePermission: %w", res.Error)
	}
	return nil
}

func ListFilePermissions(fileID string) ([]*FilePermission, error) {
	var perms []*FilePermission
	if res := db.Where("file_id = ?", fileID).
		Order("role asc, target_id asc").Find(&perms); res.Error != nil {
		return nil, xerrors.Errorf("ListFilePermissions: %w", res.Error)
	}
	return perms, nil
}

func DeleteFilePermissions(fileID string) error {
	if res := db.Where("file_id = ?", fileID).Delete(&FilePermission{}); res.Error != nil {
		return xerrors.Errorf("DeleteFilePermissions: %w", res.Error)
	}
	return nil
}

// ── ファイル権限判定 ──────────────────────────────────────

func HasFileAccess(fileID, userID string) (bool, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return false, err
	}
	var count int64
	if res := db.Model(&FilePermission{}).
		Where("file_id = ? AND target_id IN ?", fileID, ids).
		Count(&count); res.Error != nil {
		return false, xerrors.Errorf("HasFileAccess: %w", res.Error)
	}
	return count > 0, nil
}

func HasFileRole(fileID, userID string, roles []string) (bool, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return false, err
	}
	var count int64
	if res := db.Model(&FilePermission{}).
		Where("file_id = ? AND target_id IN ? AND role IN ?", fileID, ids, roles).
		Count(&count); res.Error != nil {
		return false, xerrors.Errorf("HasFileRole: %w", res.Error)
	}
	return count > 0, nil
}

func GetUserFileRole(fileID, userID string) (string, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return "", err
	}
	var perms []FilePermission
	if res := db.Where("file_id = ? AND target_id IN ?", fileID, ids).
		Find(&perms); res.Error != nil {
		return "", xerrors.Errorf("GetUserFileRole: %w", res.Error)
	}
	priority := map[string]int{RoleOwner: 4, RoleRunner: 3, RoleEditor: 2, RoleViewer: 1}
	best := ""
	bestP := 0
	for _, p := range perms {
		if priority[p.Role] > bestP {
			best = p.Role
			bestP = priority[p.Role]
		}
	}
	return best, nil
}

// CopyProjectPermissionsToFile はプロジェクトの権限をファイルにコピーする。
func CopyProjectPermissionsToFile(projectID, fileID string) error {
	perms, err := ListProjectPermissions(projectID)
	if err != nil {
		return err
	}
	for _, p := range perms {
		if err := SetFilePermission(fileID, p.TargetID, p.Role); err != nil {
			return err
		}
	}
	return nil
}

// ══════════════════════════════════════════════════════════
// デフォルト権限
// ══════════════════════════════════════════════════════════

// ListAccessibleProjectIDs はユーザがアクセス可能なプロジェクトIDの一覧を返す。
func ListAccessibleProjectIDs(userID string) ([]string, error) {
	ids, err := collectTargetIDs(userID)
	if err != nil {
		return nil, err
	}
	var projectIDs []string
	if res := db.Model(&ProjectPermission{}).
		Where("target_id IN ?", ids).
		Distinct("project_id").
		Pluck("project_id", &projectIDs); res.Error != nil {
		return nil, xerrors.Errorf("ListAccessibleProjectIDs: %w", res.Error)
	}
	return projectIDs, nil
}

// SetDefaultProjectPermissions はプロジェクト作成時のデフォルト権限を設定する。
// creatorID: 作成者のユーザID
func SetDefaultProjectPermissions(projectID, creatorID string) error {
	// 作成者 → owner
	if err := SetProjectPermission(projectID, creatorID, RoleOwner); err != nil {
		return err
	}
	// BrenderOwner → owner（作成者と異なる場合）
	if creatorID != UserIDOwner {
		if err := SetProjectPermission(projectID, UserIDOwner, RoleOwner); err != nil {
			return err
		}
	}
	// All グループ → viewer
	if err := SetProjectPermission(projectID, GroupIDAll, RoleViewer); err != nil {
		return err
	}
	return nil
}
