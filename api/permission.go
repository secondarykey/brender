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

func HasProjectAccess(projectID, userID string) (bool, error) {
	return model.HasProjectAccess(projectID, userID)
}

func HasProjectRole(projectID, userID string, roles []string) (bool, error) {
	return model.HasProjectRole(projectID, userID, roles)
}

func GetUserProjectRole(projectID, userID string) (string, error) {
	return model.GetUserProjectRole(projectID, userID)
}
