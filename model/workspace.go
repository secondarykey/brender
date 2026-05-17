package model

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Workspace struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	ProjectId        string     `json:"project_id"`
	ProjectFileID    string     `json:"project_file_id"`
	BlenderInstallID uint       `json:"blender_install_id"` // 0 = プロジェクトのデフォルト使用
	Name             string     `json:"name"`
	Note             string     `json:"note"`
	Scene            string     `json:"scene"`
	Camera           string     `json:"camera"`
	Engine           string     `json:"engine"`              // "" = Blender デフォルト
	StartFrame       int        `json:"start"`
	EndFrame         int        `json:"end"`
	FrameStep        int        `json:"frame_step"`          // 0,1 = 毎フレーム
	Thread           int        `json:"thread"`              // 0 = 全コア自動
	Samples          int        `json:"samples"`             // 0 = Blender デフォルト
	ResolutionX      int        `json:"resolution_x"`        // 0 = Blender デフォルト
	ResolutionY      int        `json:"resolution_y"`        // 0 = Blender デフォルト
	OutputFormat     string     `json:"output_format"` // "PNG" / "JPEG"。空 = システムデフォルト委譲
	AutoLock        bool       `gorm:"default:false" json:"auto_lock"`      // 完了時自動ロック
	AutoLockMinSize int64      `gorm:"default:0" json:"auto_lock_min_size"` // 自動ロック対象の最小容量（バイト）。0=制限なし
	AutoLockKeep    int        `gorm:"default:1" json:"auto_lock_keep"`     // ロック保持件数。0=無制限
	IsSystem         bool       `gorm:"default:false" json:"is_system"`
	DisplayOrder     int        `gorm:"default:99999" json:"display_order"`
	ProcessedAt      *time.Time `json:"processed_at"`
	MetaFields       `gorm:"embedded"`
}

// ワークスペース詳細（設定画面用）
type WorkspaceDetail struct {
	Workspace    *Workspace     `json:"workspace"`
	ProjectFiles []*ProjectFile `json:"project_files"`
}

// ファイル単位にまとめたワークスペース一覧
type WorkspacesByFile struct {
	File       *ProjectFile `json:"file"`
	Workspaces []*Workspace `json:"workspaces"`
}

func newWorkspaceID() (string, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return "", xerrors.Errorf("uuid.NewRandom: %w", err)
	}
	return id.String(), nil
}

func ListWorkspacesByProject(projectID string, sort, dir string) ([]*WorkspacesByFile, error) {
	order := resolveOrder(sort, dir)
	var files []*ProjectFile
	if res := db.Where("project_id = ?", projectID).Order(order).Find(&files); res.Error != nil {
		return nil, xerrors.Errorf("ListWorkspacesByProject files: %w", res.Error)
	}

	result := make([]*WorkspacesByFile, 0, len(files))
	for _, f := range files {
		var ws []*Workspace
		if res := db.Where("project_id = ? AND project_file_id = ? AND is_system = ?", projectID, f.ID, false).
			Order(order).Find(&ws); res.Error != nil {
			return nil, xerrors.Errorf("ListWorkspacesByProject workspaces: %w", res.Error)
		}
		result = append(result, &WorkspacesByFile{File: f, Workspaces: ws})
	}
	return result, nil
}

func GetWorkspace(projectID string, workspaceID string) (*WorkspaceDetail, error) {
	var w Workspace
	res := db.First(&w, "id = ? AND project_id = ?", workspaceID, projectID)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetWorkspace: %w", res.Error)
	}

	var files []*ProjectFile
	if res := db.Where("project_id = ?", projectID).Find(&files); res.Error != nil {
		return nil, xerrors.Errorf("GetWorkspace files: %w", res.Error)
	}

	return &WorkspaceDetail{Workspace: &w, ProjectFiles: files}, nil
}

func CreateWorkspace(projectID string, projectFileID string, name string, isSystem bool) (*Workspace, error) {
	id, err := newWorkspaceID()
	if err != nil {
		return nil, xerrors.Errorf("newWorkspaceID: %w", err)
	}
	w := &Workspace{
		ID:            id,
		ProjectId:     projectID,
		ProjectFileID: projectFileID,
		Name:          name,
		StartFrame:    0,
		EndFrame:      -1,
		IsSystem:      isSystem,
	}
	if res := db.Create(w); res.Error != nil {
		return nil, xerrors.Errorf("CreateWorkspace: %w", res.Error)
	}
	return w, nil
}

func CreateWorkspaceWithSettings(projectID, projectFileID, name, scene, camera, engine string) (*Workspace, error) {
	id, err := newWorkspaceID()
	if err != nil {
		return nil, xerrors.Errorf("newWorkspaceID: %w", err)
	}
	w := &Workspace{
		ID:            id,
		ProjectId:     projectID,
		ProjectFileID: projectFileID,
		Name:          name,
		Scene:         scene,
		Camera:        camera,
		Engine:        engine,
		StartFrame:    0,
		EndFrame:      -1,
	}
	if res := db.Create(w); res.Error != nil {
		return nil, xerrors.Errorf("CreateWorkspaceWithSettings: %w", res.Error)
	}
	return w, nil
}

func CreateSystemWorkspace(projectID string, projectFileID string, name string, startFrame, endFrame, samples int) (*Workspace, error) {
	id, err := newWorkspaceID()
	if err != nil {
		return nil, xerrors.Errorf("newWorkspaceID: %w", err)
	}
	w := &Workspace{
		ID:            id,
		ProjectId:     projectID,
		ProjectFileID: projectFileID,
		Name:          name,
		StartFrame:    startFrame,
		EndFrame:      endFrame,
		Samples:       samples,
		IsSystem:      true,
	}
	if res := db.Create(w); res.Error != nil {
		return nil, xerrors.Errorf("CreateSystemWorkspace: %w", res.Error)
	}
	return w, nil
}

func UpdateWorkspace(projectID string, workspaceID string, name string, note string, blenderInstallID uint, scene, camera, engine string, startFrame, endFrame, frameStep, thread, samples, resolutionX, resolutionY int, outputFormat string, autoLock bool, autoLockMinSize int64, autoLockKeep int) (*WorkspaceDetail, error) {
	var w Workspace
	if res := db.First(&w, "id = ? AND project_id = ?", workspaceID, projectID); res.Error != nil {
		return nil, xerrors.Errorf("UpdateWorkspace find: %w", res.Error)
	}
	w.Name = name
	w.Note = note
	w.BlenderInstallID = blenderInstallID
	w.Scene = scene
	w.Camera = camera
	w.Engine = engine
	w.StartFrame = startFrame
	w.EndFrame = endFrame
	w.FrameStep = frameStep
	w.Thread = thread
	w.Samples = samples
	w.ResolutionX = resolutionX
	w.ResolutionY = resolutionY
	w.OutputFormat = outputFormat
	w.AutoLock = autoLock
	w.AutoLockMinSize = autoLockMinSize
	w.AutoLockKeep = autoLockKeep
	if res := db.Save(&w); res.Error != nil {
		return nil, xerrors.Errorf("UpdateWorkspace save: %w", res.Error)
	}
	return GetWorkspace(projectID, workspaceID)
}

func UpdateWorkspaceProcessedAt(id string, t *time.Time) error {
	if res := db.Model(&Workspace{}).Where("id = ?", id).Update("processed_at", t); res.Error != nil {
		return xerrors.Errorf("UpdateWorkspaceProcessedAt: %w", res.Error)
	}
	return nil
}

func GetSystemWorkspaceByFile(projectFileID string) (*Workspace, error) {
	var w Workspace
	res := db.Where("project_file_id = ? AND is_system = ?", projectFileID, true).First(&w)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetSystemWorkspaceByFile: %w", res.Error)
	}
	return &w, nil
}

func SelectWorkspace(pId string, wId string) (*Workspace, error) {
	var w Workspace
	if res := db.First(&w, "id = ? AND project_id = ?", wId, pId); res.Error != nil {
		return nil, xerrors.Errorf("SelectWorkspace: %w", res.Error)
	}
	return &w, nil
}

func CountWorkspacesByBlender(blenderID uint) (int64, error) {
	var count int64
	if res := db.Model(&Workspace{}).Where("blender_install_id = ?", blenderID).Count(&count); res.Error != nil {
		return 0, xerrors.Errorf("CountWorkspacesByBlender: %w", res.Error)
	}
	return count, nil
}

func DeleteWorkspace(projectID, workspaceID string) error {
	if res := db.Delete(&Workspace{}, "id = ? AND project_id = ?", workspaceID, projectID); res.Error != nil {
		return xerrors.Errorf("DeleteWorkspace: %w", res.Error)
	}
	return nil
}

func DeleteWorkspacesByProjectFile(fileID string) error {
	if res := db.Delete(&Workspace{}, "project_file_id = ?", fileID); res.Error != nil {
		return xerrors.Errorf("DeleteWorkspacesByProjectFile: %w", res.Error)
	}
	return nil
}

func DeleteWorkspacesByProject(projectID string) error {
	if res := db.Delete(&Workspace{}, "project_id = ?", projectID); res.Error != nil {
		return xerrors.Errorf("DeleteWorkspacesByProject: %w", res.Error)
	}
	return nil
}
