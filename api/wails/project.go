package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Project struct{}

func NewProject() *Project {
	var p Project
	return &p
}

func (s *Project) List(sort, dir string) ([]*model.ProjectDetail, error) {
	return api.ListProjects(api.WailsContext(), sort, dir)
}

func (s *Project) Get(id string) (*model.ProjectDetail, error) {
	return api.GetProject(api.WailsContext(), id)
}

func (s *Project) Create(name string) (*model.ProjectDetail, error) {
	return api.CreateProject(api.WailsContext(), name)
}

func (s *Project) Delete(id string, force bool) error {
	return api.DeleteProject(api.WailsContext(), id, force)
}

func (s *Project) Update(id, name, note string) (*model.ProjectDetail, error) {
	return api.UpdateProject(api.WailsContext(), id, name, note)
}

func (s *Project) UpdateFile(fileID string, name string, note string, blenderInstallID uint, blenderFixed bool, scene string, sceneFixed bool, camera string, cameraFixed bool, engine string, engineFixed bool) (*model.ProjectFile, error) {
	return api.UpdateProjectFile(api.WailsContext(), fileID, name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed)
}

func (s *Project) GetFile(fileID string) (*model.ProjectFile, error) {
	return api.GetFile(api.WailsContext(), fileID)
}

func (s *Project) ListAllFiles() ([]*model.ProjectFile, error) {
	return api.ListAllProjectFiles()
}

func (s *Project) AddFile(projectID, path string) (*model.ProjectFile, error) {
	return api.AddProjectFile(api.WailsContext(), projectID, path)
}

func (s *Project) AddFilesFromDir(projectID, dir string) (*api.AddDirResult, error) {
	return api.AddFilesFromDirectory(api.WailsContext(), projectID, dir)
}

func (s *Project) RemoveFile(fileID string) error {
	return api.RemoveProjectFile(fileID)
}

func (s *Project) DeleteFile(fileID string, force bool) error {
	return api.DeleteProjectFile(api.WailsContext(), fileID, force)
}

func (s *Project) GetFileThumbnail(projectID string, fileID string) (string, error) {
	return api.GetFileThumbnail(projectID, fileID)
}

func (s *Project) GetProjectThumbnail(projectID string) (string, error) {
	return api.GetProjectThumbnail(projectID)
}

func (s *Project) SetProjectThumbnail(projectID string, imagePath string) (string, error) {
	return api.SetProjectThumbnail(projectID, imagePath)
}

func (s *Project) SetFileThumbnail(projectID string, fileID string, imagePath string) (string, error) {
	return api.SetFileThumbnail(projectID, fileID, imagePath)
}

func (s *Project) SetFileThumbnailFromWorkspace(projectID string, fileID string, workspaceID string) (string, error) {
	return api.SetFileThumbnailFromWorkspace(api.WailsContext(), projectID, fileID, workspaceID)
}

func (s *Project) SetProjectThumbnailFromFile(projectID string, fileID string) (string, error) {
	return api.SetProjectThumbnailFromFile(projectID, fileID)
}

// ── Permission ────────────────────────────────────────────

func (s *Project) SetPermission(projectID, targetID, role string) error {
	return api.SetProjectPermission(api.WailsContext(), projectID, targetID, role)
}

func (s *Project) RemovePermission(projectID, targetID string) error {
	return api.RemoveProjectPermission(api.WailsContext(), projectID, targetID)
}

func (s *Project) ListPermissions(projectID string) ([]*api.PermissionEntry, error) {
	return api.ListProjectPermissions(projectID)
}

func (s *Project) GetUserRole(projectID, userID string) (string, error) {
	return api.GetUserProjectRole(projectID, userID)
}

// ── File Permission ───────────────────────────────────────

func (s *Project) SetFilePermission(fileID, targetID, role string) error {
	return api.SetFilePermission(api.WailsContext(), fileID, targetID, role)
}

func (s *Project) RemoveFilePermission(fileID, targetID string) error {
	return api.RemoveFilePermission(api.WailsContext(), fileID, targetID)
}

func (s *Project) ListFilePermissions(fileID string) ([]*api.PermissionEntry, error) {
	return api.ListFilePermissions(fileID)
}

func (s *Project) GetUserFileRole(fileID, userID string) (string, error) {
	return api.GetUserFileRole(fileID, userID)
}
