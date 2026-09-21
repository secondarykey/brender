package model

import "golang.org/x/xerrors"

type BlenderInstall struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Path      string `json:"path"`
	Version   string `json:"version"`
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
	MetaFields
}

func GetBlenderInstall(id uint) (*BlenderInstall, error) {
	var b BlenderInstall
	res := db.First(&b, id)
	if res.Error != nil {
		return nil, xerrors.Errorf("GetBlenderInstall: %w", res.Error)
	}
	return &b, nil
}

func FirstBlender() (*BlenderInstall, error) {
	var b BlenderInstall
	res := db.Order("sort_order, id").First(&b)
	if res.Error != nil {
		return nil, xerrors.Errorf("FirstBlender: %w", res.Error)
	}
	return &b, nil
}

func ListBlenders() ([]*BlenderInstall, error) {
	var list []*BlenderInstall
	res := db.Order("sort_order, id").Find(&list)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListBlenders error: %w", res.Error)
	}
	return list, nil
}

func AddBlenderInstall(path, version, name string) (*BlenderInstall, error) {
	var maxOrder int
	db.Model(&BlenderInstall{}).Select("COALESCE(MAX(sort_order), 0)").Scan(&maxOrder)

	b := &BlenderInstall{
		Path:      path,
		Version:   version,
		Name:      name,
		SortOrder: maxOrder + 1,
	}
	res := db.Create(b)
	if res.Error != nil {
		return nil, xerrors.Errorf("AddBlenderInstall error: %w", res.Error)
	}
	return b, nil
}

func UpdateBlenderVersion(id uint, version string) error {
	res := db.Model(&BlenderInstall{}).Where("id = ?", id).Update("version", version)
	if res.Error != nil {
		return xerrors.Errorf("UpdateBlenderVersion error: %w", res.Error)
	}
	return nil
}

func RemoveBlenderInstall(id uint) error {
	res := db.Delete(&BlenderInstall{}, id)
	if res.Error != nil {
		return xerrors.Errorf("RemoveBlenderInstall error: %w", res.Error)
	}
	return nil
}

func ReorderBlenders(ids []uint) error {
	for i, id := range ids {
		res := db.Model(&BlenderInstall{}).Where("id = ?", id).Update("sort_order", i)
		if res.Error != nil {
			return xerrors.Errorf("ReorderBlenders error: %w", res.Error)
		}
	}
	return nil
}

// BlenderReference は BlenderInstall を参照しているエンティティ1件を表す。
// Kind は "workspace" / "file"。
type BlenderReference struct {
	Kind          string `json:"kind"`
	ProjectID     string `json:"project_id"`
	ProjectName   string `json:"project_name"`
	FileID        string `json:"file_id"`
	FileName      string `json:"file_name"`
	WorkspaceID   string `json:"workspace_id"`
	WorkspaceName string `json:"workspace_name"`
	IsSystem      bool   `json:"is_system"`
}

// ListBlenderReferences は指定 Blender を参照しているワークスペース・ファイルを
// 列挙する。削除できない理由（どれが掴んでいるか）を提示するために使う。
// Project は BlenderInstallID を持たないので対象外。
// ワークスペース件数は CountWorkspacesByBlender と一致する（論理削除済みは除外）。
func ListBlenderReferences(blenderID uint) ([]*BlenderReference, error) {
	refs := []*BlenderReference{}

	var ws []*BlenderReference
	res := db.Raw(`
SELECT 'workspace' AS kind,
       w.project_id      AS project_id,
       COALESCE(p.name, '') AS project_name,
       w.project_file_id AS file_id,
       COALESCE(f.name, '') AS file_name,
       w.id              AS workspace_id,
       w.name            AS workspace_name,
       w.is_system       AS is_system
  FROM workspaces w
  LEFT JOIN projects p      ON p.id = w.project_id      AND p.deleted_at IS NULL
  LEFT JOIN project_files f ON f.id = w.project_file_id AND f.deleted_at IS NULL
 WHERE w.blender_install_id = ? AND w.deleted_at IS NULL
 ORDER BY p.name, f.name, w.display_order, w.name`, blenderID).Scan(&ws)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListBlenderReferences(workspace): %w", res.Error)
	}
	refs = append(refs, ws...)

	var files []*BlenderReference
	res = db.Raw(`
SELECT 'file' AS kind,
       f.project_id AS project_id,
       COALESCE(p.name, '') AS project_name,
       f.id         AS file_id,
       f.name       AS file_name,
       ''           AS workspace_id,
       ''           AS workspace_name,
       0            AS is_system
  FROM project_files f
  LEFT JOIN projects p ON p.id = f.project_id AND p.deleted_at IS NULL
 WHERE f.blender_install_id = ? AND f.deleted_at IS NULL
 ORDER BY p.name, f.display_order, f.name`, blenderID).Scan(&files)
	if res.Error != nil {
		return nil, xerrors.Errorf("ListBlenderReferences(file): %w", res.Error)
	}
	refs = append(refs, files...)

	return refs, nil
}
