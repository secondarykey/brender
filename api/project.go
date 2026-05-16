package api

import (
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func ListProjects(sort, dir string) ([]*model.ProjectDetail, error) {
	return model.ListProjects(sort, dir)
}

func GetProject(id string) (*model.ProjectDetail, error) {
	return model.GetProject(id)
}

func UpdateProject(id, name, note string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	return model.UpdateProject(id, name, note)
}

func UpdateProjectFile(fileID string, name string, note string, blenderInstallID uint, blenderFixed bool, scene string, sceneFixed bool, camera string, cameraFixed bool, engine string, engineFixed bool) (*model.ProjectFile, error) {
	if name == "" {
		return nil, xerrors.New("file name is required")
	}
	return model.UpdateProjectFile(fileID, name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed)
}

func GetFile(fileID string) (*model.ProjectFile, error) {
	return model.GetProjectFile(fileID)
}

func AddProjectFile(projectID, path string) (*model.ProjectFile, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, xerrors.Errorf("file not found: %s", path)
	}
	f, err := model.AddProjectFile(projectID, path)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateProjectFileProcessedAt(f.ID, &now); err != nil {
		slog.Error("AddProjectFile: UpdateProjectFileProcessedAt", "error", err)
	}
	touchProjectProcessedAt(projectID)
	go func() {
		if err := CreateThumbnailWorkspace(projectID, f); err != nil {
			slog.Error("thumbnail workspace creation failed", "fileID", f.ID, "error", err)
		}
	}()
	return f, nil
}

type AddDirResult struct {
	Added   int      `json:"added"`
	Skipped int      `json:"skipped"`
	Errors  []string `json:"errors,omitempty"`
}

func AddFilesFromDirectory(projectID, dir string) (*AddDirResult, error) {
	if _, err := os.Stat(dir); err != nil {
		return nil, xerrors.Errorf("directory not found: %s", dir)
	}
	detail, err := model.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	existingPaths := make(map[string]struct{})
	for _, f := range detail.Files {
		existingPaths[filepath.Clean(f.Path)] = struct{}{}
	}
	result := &AddDirResult{}
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(d.Name()), ".blend") {
			return nil
		}
		absPath := filepath.Clean(path)
		if _, ok := existingPaths[absPath]; ok {
			result.Skipped++
			return nil
		}
		if _, err := AddProjectFile(projectID, absPath); err != nil {
			result.Errors = append(result.Errors, filepath.Base(path)+": "+err.Error())
			return nil
		}
		result.Added++
		time.Sleep(500 * time.Millisecond)
		return nil
	})
	return result, nil
}

func RemoveProjectFile(fileID string) error {
	return model.RemoveProjectFile(fileID)
}

func DeleteProjectFile(fileID string, force bool) error {
	if !force {
		locked, err := model.HasLockedJobsByProjectFile(fileID)
		if err != nil {
			return xerrors.Errorf("DeleteProjectFile: %w", err)
		}
		if locked {
			return xerrors.New("locked_jobs_exist")
		}
	}
	dirs, _ := model.ListOutputDirsByProjectFile(fileID)
	removeOutputDirs(dirs)
	// ジョブディレクトリ削除後、{fileID}/ ディレクトリごと削除する
	// （サムネイルや空の {workspaceID}/ ディレクトリを含む）
	if len(dirs) > 0 {
		fileDir := filepath.Dir(filepath.Dir(dirs[0]))
		if err := os.RemoveAll(fileDir); err != nil {
			slog.Warn("DeleteProjectFile: remove file dir", "error", err)
		}
	} else {
		// ジョブがなくてもサムネイルが存在する可能性があるため fileID ディレクトリを削除
		if pf, err := model.GetProjectFile(fileID); err == nil {
			if baseDir, err := GetProjectBaseDir(pf.ProjectID); err == nil {
				fileDir := filepath.Join(baseDir, pf.ProjectID, fileID)
				if err := os.RemoveAll(fileDir); err != nil {
					slog.Warn("DeleteProjectFile: remove file dir (no jobs)", "error", err)
				}
			}
		}
	}
	if err := model.DeleteJobsByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile workspaces: %w", err)
	}
	return model.RemoveProjectFile(fileID)
}

func DeleteProject(id string) error {
	dirs, _ := model.ListOutputDirsByProject(id)
	removeOutputDirs(dirs)
	if err := model.DeleteJobsByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject workspaces: %w", err)
	}
	return model.DeleteProject(id)
}

func CreateProject(name string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	p := &model.Project{}
	if err := AssignDefaultWorkDir(p); err != nil {
		return nil, err
	}
	d, err := model.CreateProject(name, nil, p.WorkDirID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateProjectProcessedAt(d.Project.ID, &now); err != nil {
		slog.Error("CreateProject: UpdateProjectProcessedAt", "error", err)
	}
	return d, nil
}

func touchProjectProcessedAt(projectID string) {
	now := time.Now()
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		slog.Error("touchProjectProcessedAt", "projectID", projectID, "error", err)
	}
}
