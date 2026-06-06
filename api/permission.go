package api

import (
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

// PermissionEntry は権限一覧表示用（ターゲットの表示名を付与）。
type PermissionEntry struct {
	ProjectID       string `json:"project_id"`
	TargetID        string `json:"target_id"`
	TargetName      string `json:"target_name"`
	TargetIsSystem  bool   `json:"target_is_system"`
	Role            string `json:"role"`
}

func SetProjectPermission(projectID, targetID, role string) error {
	// Brender Owner の権限変更は禁止
	if targetID == model.UserIDOwner {
		return xerrors.New("Brender Owner の権限は変更できません")
	}
	// ロール検証
	valid := false
	for _, r := range model.AllRoles {
		if r == role {
			valid = true
			break
		}
	}
	if !valid {
		return xerrors.Errorf("invalid role: %s", role)
	}
	return model.SetProjectPermission(projectID, targetID, role)
}

func RemoveProjectPermission(projectID, targetID string) error {
	// Brender Owner の権限削除は禁止
	if targetID == model.UserIDOwner {
		return xerrors.New("Brender Owner の権限は削除できません")
	}
	return model.RemoveProjectPermission(projectID, targetID)
}

// ListProjectPermissions はプロジェクトの権限一覧を表示名付きで返す。
func ListProjectPermissions(projectID string) ([]*PermissionEntry, error) {
	perms, err := model.ListProjectPermissions(projectID)
	if err != nil {
		return nil, err
	}

	entries := make([]*PermissionEntry, 0, len(perms))
	for _, p := range perms {
		entry := &PermissionEntry{
			ProjectID: p.ProjectID,
			TargetID:  p.TargetID,
			Role:      p.Role,
		}
		// ターゲットの表示名を解決
		if len(p.TargetID) > 4 && p.TargetID[:4] == model.PrefixUser {
			if u, err := model.GetUser(p.TargetID); err == nil && u != nil {
				entry.TargetName = u.DisplayName
				entry.TargetIsSystem = u.IsSystem
			}
		} else if len(p.TargetID) > 4 && p.TargetID[:4] == model.PrefixGroup {
			if g, err := model.GetGroup(p.TargetID); err == nil && g != nil {
				entry.TargetName = g.DisplayName
				entry.TargetIsSystem = g.IsSystem
			}
		}
		if entry.TargetName == "" {
			entry.TargetName = p.TargetID
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// ── File Permission ───────────────────────────────────────

func SetFilePermission(fileID, targetID, role string) error {
	// Brender Owner の権限変更は禁止
	if targetID == model.UserIDOwner {
		return xerrors.New("Brender Owner の権限は変更できません")
	}
	valid := false
	for _, r := range model.AllRoles {
		if r == role {
			valid = true
			break
		}
	}
	if !valid {
		return xerrors.Errorf("invalid role: %s", role)
	}
	return model.SetFilePermission(fileID, targetID, role)
}

func RemoveFilePermission(fileID, targetID string) error {
	// Brender Owner の権限削除は禁止
	if targetID == model.UserIDOwner {
		return xerrors.New("Brender Owner の権限は削除できません")
	}
	return model.RemoveFilePermission(fileID, targetID)
}

func ListFilePermissions(fileID string) ([]*PermissionEntry, error) {
	perms, err := model.ListFilePermissions(fileID)
	if err != nil {
		return nil, err
	}
	entries := make([]*PermissionEntry, 0, len(perms))
	for _, p := range perms {
		entry := &PermissionEntry{
			ProjectID: p.FileID, // ResourceID として流用
			TargetID:  p.TargetID,
			Role:      p.Role,
		}
		if len(p.TargetID) > 4 && p.TargetID[:4] == model.PrefixUser {
			if u, err := model.GetUser(p.TargetID); err == nil && u != nil {
				entry.TargetName = u.DisplayName
				entry.TargetIsSystem = u.IsSystem
			}
		} else if len(p.TargetID) > 4 && p.TargetID[:4] == model.PrefixGroup {
			if g, err := model.GetGroup(p.TargetID); err == nil && g != nil {
				entry.TargetName = g.DisplayName
				entry.TargetIsSystem = g.IsSystem
			}
		}
		if entry.TargetName == "" {
			entry.TargetName = p.TargetID
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func HasFileAccess(fileID, userID string) (bool, error) {
	return model.HasFileAccess(fileID, userID)
}

func HasFileRole(fileID, userID string, roles []string) (bool, error) {
	return model.HasFileRole(fileID, userID, roles)
}

func GetUserFileRole(fileID, userID string) (string, error) {
	return model.GetUserFileRole(fileID, userID)
}

// ── Access check helpers ─────────────────────────────────

func HasProjectAccess(projectID, userID string) (bool, error) {
	return model.HasProjectAccess(projectID, userID)
}

func HasProjectRole(projectID, userID string, roles []string) (bool, error) {
	return model.HasProjectRole(projectID, userID, roles)
}

func GetUserProjectRole(projectID, userID string) (string, error) {
	return model.GetUserProjectRole(projectID, userID)
}
