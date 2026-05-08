package model

import (
	"errors"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Workspace struct {
	ID               string `gorm:"primaryKey" json:"id"`
	ProjectId        string `json:"project_id"`
	ProjectFileID    uint   `json:"project_file_id"`
	BlenderInstallID uint   `json:"blender_install_id"` // 0 = プロジェクトのデフォルト使用
	Name             string `json:"name"`
	Scene            string `json:"scene"`
	Engine           string `json:"engine"`     // "" = Blender デフォルト
	StartFrame       int    `json:"start"`
	EndFrame         int    `json:"end"`
	FrameStep        int    `json:"frame_step"` // 0,1 = 毎フレーム
	Thread           int    `json:"thread"`     // 0 = 全コア自動
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

func ListWorkspacesByProject(projectID string) ([]*WorkspacesByFile, error) {
	var files []*ProjectFile
	if res := db.Where("project_id = ?", projectID).Find(&files); res.Error != nil {
		return nil, xerrors.Errorf("ListWorkspacesByProject files: %w", res.Error)
	}

	result := make([]*WorkspacesByFile, 0, len(files))
	for _, f := range files {
		var ws []*Workspace
		if res := db.Where("project_id = ? AND project_file_id = ?", projectID, f.ID).
			Order("created_at").Find(&ws); res.Error != nil {
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

func CreateWorkspace(projectID string, projectFileID uint, name string) (*Workspace, error) {
	id, err := newWorkspaceID()
	if err != nil {
		return nil, xerrors.Errorf("newWorkspaceID: %w", err)
	}
	w := &Workspace{
		ID:            id,
		ProjectId:     projectID,
		ProjectFileID: projectFileID,
		Name:          name,
	}
	if res := db.Create(w); res.Error != nil {
		return nil, xerrors.Errorf("CreateWorkspace: %w", res.Error)
	}
	return w, nil
}

func UpdateWorkspace(projectID string, workspaceID string, name string, blenderInstallID uint, scene, engine string, startFrame, endFrame, frameStep, thread int) (*WorkspaceDetail, error) {
	var w Workspace
	if res := db.First(&w, "id = ? AND project_id = ?", workspaceID, projectID); res.Error != nil {
		return nil, xerrors.Errorf("UpdateWorkspace find: %w", res.Error)
	}
	w.Name = name
	w.BlenderInstallID = blenderInstallID
	w.Scene = scene
	w.Engine = engine
	w.StartFrame = startFrame
	w.EndFrame = endFrame
	w.FrameStep = frameStep
	w.Thread = thread
	if res := db.Save(&w); res.Error != nil {
		return nil, xerrors.Errorf("UpdateWorkspace save: %w", res.Error)
	}
	return GetWorkspace(projectID, workspaceID)
}

func SelectWorkspace(pId string, wId string) (*Workspace, error) {
	var w Workspace
	if res := db.First(&w, "id = ? AND project_id = ?", wId, pId); res.Error != nil {
		return nil, xerrors.Errorf("SelectWorkspace: %w", res.Error)
	}
	return &w, nil
}

func DeleteWorkspace(projectID, workspaceID string) error {
	if res := db.Delete(&Workspace{}, "id = ? AND project_id = ?", workspaceID, projectID); res.Error != nil {
		return xerrors.Errorf("DeleteWorkspace: %w", res.Error)
	}
	return nil
}

func DeleteWorkspacesByProjectFile(fileID uint) error {
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
