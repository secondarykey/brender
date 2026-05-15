package model

import (
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

type Project struct {
	ID           string     `gorm:"primaryKey" json:"id"`
	Name         string     `json:"name"`
	WorkDirID    uint       `json:"work_dir_id"`
	DisplayOrder int        `gorm:"default:99999" json:"display_order"`
	ProcessedAt  *time.Time `json:"processed_at"`
	MetaFields   `gorm:"embedded"`
}

// プロジェクトに属する .blend ファイル
type ProjectFile struct {
	ID               string     `gorm:"primaryKey" json:"id"`
	ProjectID        string     `json:"project_id"`
	Path             string     `json:"path"`
	Name             string     `json:"name"`
	BlenderInstallID uint       `json:"blender_install_id"`
	BlenderFixed     bool       `json:"blender_fixed"`  // true = ワークスペースで変更不可
	Scene            string     `json:"scene"`
	SceneFixed       bool       `json:"scene_fixed"`    // true = ワークスペースで変更不可
	Camera           string     `json:"camera"`
	CameraFixed      bool       `json:"camera_fixed"`   // true = ワークスペースで変更不可
	Engine           string     `json:"engine"`
	EngineFixed      bool       `json:"engine_fixed"`   // true = ワークスペースで変更不可
	FileModifiedAt   *time.Time `json:"file_modified_at"`
	DisplayOrder     int        `gorm:"default:99999" json:"display_order"`
	ProcessedAt      *time.Time `json:"processed_at"`
	MetaFields       `gorm:"embedded"`
}

type ProjectDetail struct {
	Project *Project       `json:"project"`
	Files   []*ProjectFile `json:"files"`
}

func newProjectID() string {
	id, err := uuid.NewRandom()
	if err != nil {
		panic(err)
	}
	return id.String()
}

func newFileID() string {
	id, err := uuid.NewRandom()
	if err != nil {
		panic(err)
	}
	return id.String()
}

func ListProjects(sort, dir string) ([]*ProjectDetail, error) {
	var projects []*Project
	if res := db.Order(resolveOrder(sort, dir)).Find(&projects); res.Error != nil {
		return nil, xerrors.Errorf("ListProjects: %w", res.Error)
	}

	details := make([]*ProjectDetail, 0, len(projects))
	for _, p := range projects {
		d, err := loadProjectDetail(p)
		if err != nil {
			return nil, err
		}
		details = append(details, d)
	}
	return details, nil
}

func GetProject(id string) (*ProjectDetail, error) {
	var p Project
	res := db.First(&p, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetProject: %w", res.Error)
	}
	return loadProjectDetail(&p)
}

func loadProjectDetail(p *Project) (*ProjectDetail, error) {
	var files []*ProjectFile
	if res := db.Where("project_id = ?", p.ID).Find(&files); res.Error != nil {
		return nil, xerrors.Errorf("loadProjectFiles: %w", res.Error)
	}
	return &ProjectDetail{Project: p, Files: files}, nil
}

// SelectProject は exec パッケージとの互換性のために残す
func SelectProject(id string) (*Project, error) {
	var p Project
	res := db.First(&p, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("SelectProject: %w", res.Error)
	}
	return &p, nil
}


func GetProjectFile(fileID string) (*ProjectFile, error) {
	var f ProjectFile
	res := db.First(&f, "id = ?", fileID)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetProjectFile: %w", res.Error)
	}
	return &f, nil
}

// FirstFile はプロジェクトの最初の ProjectFile を返す（exec パッケージ用）
func FirstFile(projectID string) (*ProjectFile, error) {
	var f ProjectFile
	res := db.Where("project_id = ?", projectID).First(&f)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("FirstFile: %w", res.Error)
	}
	return &f, nil
}


func UpdateProject(id, name string) (*ProjectDetail, error) {
	var p Project
	if res := db.First(&p, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateProject find: %w", res.Error)
	}
	p.Name = name
	if res := db.Save(&p); res.Error != nil {
		return nil, xerrors.Errorf("UpdateProject save: %w", res.Error)
	}
	return loadProjectDetail(&p)
}

func UpdateProjectFile(fileID string, name string, blenderInstallID uint, blenderFixed bool, scene string, sceneFixed bool, camera string, cameraFixed bool, engine string, engineFixed bool) (*ProjectFile, error) {
	var f ProjectFile
	if res := db.First(&f, "id = ?", fileID); res.Error != nil {
		return nil, xerrors.Errorf("UpdateProjectFile find: %w", res.Error)
	}
	f.Name = name
	f.BlenderInstallID = blenderInstallID
	f.BlenderFixed = blenderFixed
	f.Scene = scene
	f.SceneFixed = sceneFixed
	f.Camera = camera
	f.CameraFixed = cameraFixed
	f.Engine = engine
	f.EngineFixed = engineFixed
	if res := db.Save(&f); res.Error != nil {
		return nil, xerrors.Errorf("UpdateProjectFile save: %w", res.Error)
	}
	return &f, nil
}

func AddProjectFile(projectID, path string) (*ProjectFile, error) {
	var modAt *time.Time
	if info, err := os.Stat(path); err == nil {
		t := info.ModTime()
		modAt = &t
	}
	f := &ProjectFile{
		ID:             newFileID(),
		ProjectID:      projectID,
		Path:           path,
		Name:           filepath.Base(path),
		FileModifiedAt: modAt,
	}
	if res := db.Create(f); res.Error != nil {
		return nil, xerrors.Errorf("AddProjectFile: %w", res.Error)
	}
	return f, nil
}

func RemoveProjectFile(fileID string) error {
	if res := db.Delete(&ProjectFile{}, "id = ?", fileID); res.Error != nil {
		return xerrors.Errorf("RemoveProjectFile: %w", res.Error)
	}
	return nil
}

func DeleteProject(id string) error {
	if res := db.Delete(&Project{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteProject: %w", res.Error)
	}
	if res := db.Delete(&ProjectFile{}, "project_id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteProject files: %w", res.Error)
	}
	return nil
}

func UpdateProjectProcessedAt(id string, t *time.Time) error {
	if res := db.Model(&Project{}).Where("id = ?", id).Update("processed_at", t); res.Error != nil {
		return xerrors.Errorf("UpdateProjectProcessedAt: %w", res.Error)
	}
	return nil
}

func UpdateProjectFileProcessedAt(id string, t *time.Time) error {
	if res := db.Model(&ProjectFile{}).Where("id = ?", id).Update("processed_at", t); res.Error != nil {
		return xerrors.Errorf("UpdateProjectFileProcessedAt: %w", res.Error)
	}
	return nil
}

func CreateProject(name string, paths []string, workDirID uint) (*ProjectDetail, error) {
	p := &Project{
		ID:        newProjectID(),
		Name:      name,
		WorkDirID: workDirID,
	}
	if res := db.Create(p); res.Error != nil {
		return nil, xerrors.Errorf("CreateProject: %w", res.Error)
	}

	for _, path := range paths {
		f := &ProjectFile{
			ID:        newFileID(),
			ProjectID: p.ID,
			Path:      path,
			Name:      filepath.Base(path),
		}
		if res := db.Create(f); res.Error != nil {
			return nil, xerrors.Errorf("CreateProjectFile: %w", res.Error)
		}
	}

	return loadProjectDetail(p)
}

func ListProjectsByWorkDir(workDirID uint) ([]*Project, error) {
	var projects []*Project
	if res := db.Where("work_dir_id = ?", workDirID).Find(&projects); res.Error != nil {
		return nil, xerrors.Errorf("ListProjectsByWorkDir: %w", res.Error)
	}
	return projects, nil
}

func UpdateProjectWorkDir(projectID string, workDirID uint) error {
	if res := db.Model(&Project{}).Where("id = ?", projectID).Update("work_dir_id", workDirID); res.Error != nil {
		return xerrors.Errorf("UpdateProjectWorkDir: %w", res.Error)
	}
	return nil
}
