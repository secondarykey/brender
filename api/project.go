package api

import (
	"io"
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
	userID := model.CurrentUser()
	// Owner は全プロジェクトを参照可能
	if userID == model.UserIDOwner {
		return model.ListProjects(sort, dir)
	}
	return model.ListProjectsForUser(userID, sort, dir)
}

func GetProject(id string) (*model.ProjectDetail, error) {
	userID := model.CurrentUser()
	// Owner は常にアクセス可能
	if userID != model.UserIDOwner {
		ok, err := model.HasProjectAccess(id, userID)
		if err != nil {
			return nil, xerrors.Errorf("GetProject permission check: %w", err)
		}
		if !ok {
			return nil, xerrors.New("access denied")
		}
		// ファイル権限でフィルタしたプロジェクト詳細を返す
		detail, err := model.GetProjectForUser(id, userID)
		if err != nil {
			return nil, err
		}
		// ユーザのロールを付与
		role, _ := model.GetUserProjectRole(id, userID)
		detail.MyRole = role
		return detail, nil
	}
	detail, err := model.GetProject(id)
	if err != nil {
		return nil, err
	}
	detail.MyRole = model.RoleOwner
	return detail, nil
}

func UpdateProject(id, name, note string) (*model.ProjectDetail, error) {
	if name == "" {
		return nil, xerrors.New("project name is required")
	}
	// Editor 以上の権限が必要
	userID := model.CurrentUser()
	if userID != model.UserIDOwner {
		ok, err := model.HasProjectRole(id, userID, []string{model.RoleOwner, model.RoleEditor})
		if err != nil {
			return nil, xerrors.Errorf("UpdateProject permission check: %w", err)
		}
		if !ok {
			return nil, xerrors.New("access denied")
		}
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
	userID := model.CurrentUser()
	if userID != model.UserIDOwner {
		ok, err := model.HasFileAccess(fileID, userID)
		if err != nil {
			return nil, xerrors.Errorf("GetFile permission check: %w", err)
		}
		if !ok {
			return nil, xerrors.New("access denied")
		}
	}
	return model.GetProjectFile(fileID)
}

// ListAllProjectFiles は全プロジェクトの全ファイルを返す（設定画面の一括確認用）。
func ListAllProjectFiles() ([]*model.ProjectFile, error) {
	return model.ListAllProjectFiles()
}

// UploadProjectFile はアップロードされたファイルを保存し、ProjectFile を登録する。
// 保存先: {workDir}/{projectID}/{fileID}/{fileID}.blend
// 登録後に非同期でPackチェックを行い、Pack済みならサムネイル自動生成を開始する。
func UploadProjectFile(projectID string, filename string, r io.Reader) (*model.ProjectFile, error) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return nil, err
	}
	// ファイルIDを先に生成してパスを決定
	f := &model.ProjectFile{
		ID:        model.NewFileID(),
		ProjectID: projectID,
		Name:      filename,
	}
	dir := filepath.Join(baseDir, projectID, f.ID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, xerrors.Errorf("UploadProjectFile MkdirAll: %w", err)
	}
	savePath := filepath.Join(dir, f.ID+".blend")
	out, err := os.Create(savePath)
	if err != nil {
		return nil, xerrors.Errorf("UploadProjectFile Create: %w", err)
	}
	if _, err := io.Copy(out, r); err != nil {
		out.Close()
		return nil, xerrors.Errorf("UploadProjectFile Copy: %w", err)
	}
	out.Close()

	f.Path = savePath
	if err := model.InsertProjectFile(f); err != nil {
		return nil, err
	}
	now := time.Now()
	if err := model.UpdateProjectFileProcessedAt(f.ID, &now); err != nil {
		slog.Error("UploadProjectFile: UpdateProjectFileProcessedAt", "error", err)
	}
	touchProjectProcessedAt(projectID)
	// プロジェクトの権限をファイルにコピー
	if err := model.CopyProjectPermissionsToFile(projectID, f.ID); err != nil {
		slog.Error("UploadProjectFile: CopyProjectPermissionsToFile", "error", err)
	}
	// 非同期でPackチェック → Pack済みならサムネイル自動生成
	go checkPackAndThumbnail(projectID, f)
	return f, nil
}

// checkPackAndThumbnail はツール実行でPack状態を検査し、DB に保存する。
// Pack 済みの場合はサムネイル自動生成を開始する。
func checkPackAndThumbnail(projectID string, f *model.ProjectFile) {
	tool, err := GetToolData(0, f.ID)
	if err != nil {
		slog.Error("checkPackAndThumbnail: GetToolData", "fileID", f.ID, "error", err)
		return
	}
	if err := model.UpdateProjectFilePacked(f.ID, tool.Pack); err != nil {
		slog.Error("checkPackAndThumbnail: UpdateProjectFilePacked", "fileID", f.ID, "error", err)
	}
	if tool.Pack {
		if err := CreateThumbnailWorkspace(projectID, f); err != nil {
			slog.Error("checkPackAndThumbnail: thumbnail creation failed", "fileID", f.ID, "error", err)
		}
	} else {
		slog.Warn("uploaded file is not packed", "fileID", f.ID, "name", f.Name)
	}
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
	// プロジェクトの権限をファイルにコピー
	if err := model.CopyProjectPermissionsToFile(projectID, f.ID); err != nil {
		slog.Error("AddProjectFile: CopyProjectPermissionsToFile", "error", err)
	}
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
	if err := model.DeleteTagsByFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile tags: %w", err)
	}
	if err := model.DeleteJobsByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProjectFile(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile workspaces: %w", err)
	}
	if err := model.DeleteFilePermissions(fileID); err != nil {
		return xerrors.Errorf("DeleteProjectFile permissions: %w", err)
	}
	return model.RemoveProjectFile(fileID)
}

func DeleteProject(id string, force bool) error {
	// Owner のみ削除可能
	userID := model.CurrentUser()
	if userID != model.UserIDOwner {
		ok, err := model.HasProjectRole(id, userID, []string{model.RoleOwner})
		if err != nil {
			return xerrors.Errorf("DeleteProject permission check: %w", err)
		}
		if !ok {
			return xerrors.New("access denied")
		}
	}
	if !force {
		locked, err := model.HasLockedJobsByProject(id)
		if err != nil {
			return xerrors.Errorf("DeleteProject: %w", err)
		}
		if locked {
			return xerrors.New("locked_jobs_exist")
		}
	}
	dirs, _ := model.ListOutputDirsByProject(id)
	removeOutputDirs(dirs)
	// ジョブディレクトリ削除後、{projectID}/ ディレクトリごと削除する
	// （プロジェクト/ファイル/ワークスペースのサムネイルや空ディレクトリを含む）
	if len(dirs) > 0 {
		projectDir := filepath.Dir(filepath.Dir(filepath.Dir(dirs[0])))
		if err := os.RemoveAll(projectDir); err != nil {
			slog.Warn("DeleteProject: remove project dir", "error", err)
		}
	} else {
		if baseDir, err := GetProjectBaseDir(id); err == nil {
			projectDir := filepath.Join(baseDir, id)
			if err := os.RemoveAll(projectDir); err != nil {
				slog.Warn("DeleteProject: remove project dir (no jobs)", "error", err)
			}
		}
	}
	if err := model.DeleteTagsByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject tags: %w", err)
	}
	if err := model.DeleteJobsByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject jobs: %w", err)
	}
	if err := model.DeleteWorkspacesByProject(id); err != nil {
		return xerrors.Errorf("DeleteProject workspaces: %w", err)
	}
	if err := model.DeleteProjectPermissions(id); err != nil {
		return xerrors.Errorf("DeleteProject permissions: %w", err)
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
	// デフォルト権限を設定（作成者 + BrenderOwner → owner, All → viewer）
	creatorID := model.CurrentUser()
	if err := model.SetDefaultProjectPermissions(d.Project.ID, creatorID); err != nil {
		slog.Error("CreateProject: SetDefaultProjectPermissions", "error", err)
	}
	return d, nil
}

func touchProjectProcessedAt(projectID string) {
	now := time.Now()
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		slog.Error("touchProjectProcessedAt", "projectID", projectID, "error", err)
	}
}
