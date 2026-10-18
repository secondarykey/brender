package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type Project struct{}

func NewProject() *Project {
	var p Project
	return &p
}

func (s *Project) List(ctx context.Context, sort, dir string) ([]*model.ProjectDetail, error) {
	return api.ListProjects(ctx, sort, dir)
}

func (s *Project) Get(ctx context.Context, id string) (*model.ProjectDetail, error) {
	return api.GetProject(ctx, id)
}

func (s *Project) Create(ctx context.Context, name string) (*model.ProjectDetail, error) {
	return api.CreateProject(ctx, name)
}

func (s *Project) Delete(ctx context.Context, id string, force bool) error {
	return api.DeleteProject(ctx, id, force)
}

func (s *Project) Update(ctx context.Context, id, name, note string) (*model.ProjectDetail, error) {
	return api.UpdateProject(ctx, id, name, note)
}

func (s *Project) UpdateFile(ctx context.Context, fileID string, name string, note string, blenderInstallID uint, blenderFixed bool, scene string, sceneFixed bool, camera string, cameraFixed bool, engine string, engineFixed bool) (*model.ProjectFile, error) {
	return api.UpdateProjectFile(ctx, fileID, name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed)
}

func (s *Project) GetFile(ctx context.Context, fileID string) (*model.ProjectFile, error) {
	return api.GetFile(ctx, fileID)
}

func (s *Project) ListAllFiles(ctx context.Context) ([]*model.ProjectFile, error) {
	return api.ListAllProjectFiles()
}

func (s *Project) AddFile(ctx context.Context, projectID, path string) (*model.ProjectFile, error) {
	return api.AddProjectFile(ctx, projectID, path)
}

func (s *Project) AddFilesFromDir(ctx context.Context, projectID, dir string) (*api.AddDirResult, error) {
	return api.AddFilesFromDirectory(ctx, projectID, dir)
}

func (s *Project) RemoveFile(ctx context.Context, fileID string) error {
	return api.RemoveProjectFile(fileID)
}

func (s *Project) DeleteFile(ctx context.Context, fileID string, force bool) error {
	return api.DeleteProjectFile(ctx, fileID, force)
}

// サムネイルはウィンドウには base64 のデータ URI、ブラウザには URL（GET /thumbnail）で返す。
// URL ならブラウザのキャッシュ（304）が効く。

func (s *Project) GetFileThumbnail(ctx context.Context, projectID string, fileID string) (string, error) {
	if api.FromBrowser(ctx) {
		return api.GetFileThumbnailURL(ctx, projectID, fileID)
	}
	return api.GetFileThumbnail(projectID, fileID)
}

func (s *Project) GetProjectThumbnail(ctx context.Context, projectID string) (string, error) {
	if api.FromBrowser(ctx) {
		return api.GetProjectThumbnailURL(ctx, projectID)
	}
	return api.GetProjectThumbnail(projectID)
}

func (s *Project) SetProjectThumbnail(ctx context.Context, projectID string, imagePath string) (string, error) {
	return api.SetProjectThumbnail(projectID, imagePath)
}

func (s *Project) SetFileThumbnail(ctx context.Context, projectID string, fileID string, imagePath string) (string, error) {
	return api.SetFileThumbnail(projectID, fileID, imagePath)
}

func (s *Project) SetFileThumbnailFromWorkspace(ctx context.Context, projectID string, fileID string, workspaceID string) (string, error) {
	return api.SetFileThumbnailFromWorkspace(ctx, projectID, fileID, workspaceID)
}

func (s *Project) SetProjectThumbnailFromFile(ctx context.Context, projectID string, fileID string) (string, error) {
	return api.SetProjectThumbnailFromFile(projectID, fileID)
}

// ── Permission ────────────────────────────────────────────

func (s *Project) SetPermission(ctx context.Context, projectID, targetID, role string) error {
	return api.SetProjectPermission(ctx, projectID, targetID, role)
}

func (s *Project) RemovePermission(ctx context.Context, projectID, targetID string) error {
	return api.RemoveProjectPermission(ctx, projectID, targetID)
}

func (s *Project) ListPermissions(ctx context.Context, projectID string) ([]*api.PermissionEntry, error) {
	return api.ListProjectPermissions(projectID)
}

func (s *Project) GetUserRole(ctx context.Context, projectID, userID string) (string, error) {
	return api.GetUserProjectRole(projectID, userID)
}

// ── File Permission ───────────────────────────────────────

func (s *Project) SetFilePermission(ctx context.Context, fileID, targetID, role string) error {
	return api.SetFilePermission(ctx, fileID, targetID, role)
}

func (s *Project) RemoveFilePermission(ctx context.Context, fileID, targetID string) error {
	return api.RemoveFilePermission(ctx, fileID, targetID)
}

func (s *Project) ListFilePermissions(ctx context.Context, fileID string) ([]*api.PermissionEntry, error) {
	return api.ListFilePermissions(fileID)
}

func (s *Project) GetUserFileRole(ctx context.Context, fileID, userID string) (string, error) {
	return api.GetUserFileRole(fileID, userID)
}
