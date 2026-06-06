package rest

import (
	"encoding/json"
	"runtime"

	brender "github.com/ikascrew/brender"
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/code"
	"github.com/ikascrew/brender/model"
	"github.com/google/uuid"
)

var appVersion string
var devMode bool

func SetVersionInfo(version string, dev bool) {
	appVersion = version
	devMode = dev
}

func (h *Handler) registerRoutes() {
	h.registerEnvironment()
	h.registerBlender()
	h.registerProject()
	h.registerWorkspace()
	h.registerQueue()
	h.registerWorkDir()
	h.registerCodes()
	h.registerTag()
	h.registerAuth()
}

// ── Environment ─────────────────────────────────────────

func (h *Handler) registerEnvironment() {
	h.register("environment", "get", func(_ json.RawMessage) (any, error) {
		return api.GetEnvironment()
	})

	h.register("environment", "set_server", func(body json.RawMessage) (any, error) {
		var p struct {
			Enabled bool   `json:"enabled"`
			Host    string `json:"host"`
			Port    int    `json:"port"`
			Auth    bool   `json:"auth"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetServer(p.Enabled, p.Host, p.Port, p.Auth)
	})

	h.register("environment", "set_ffmpeg", func(body json.RawMessage) (any, error) {
		var p struct {
			Cmd    string `json:"cmd"`
			FPS    int    `json:"fps"`
			OutExt string `json:"out_ext"`
			Args   string `json:"args"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetFfmpegSettings(api.FfmpegSettings{
			Cmd: p.Cmd, FPS: p.FPS, OutExt: p.OutExt, Args: p.Args,
		})
	})

	h.register("environment", "set_output_format", func(body json.RawMessage) (any, error) {
		var p struct {
			Format string `json:"format"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetOutputFormat(p.Format)
	})

	h.register("environment", "set_max_concurrent_jobs", func(body json.RawMessage) (any, error) {
		var p struct {
			N int `json:"n"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetMaxConcurrentJobs(p.N)
	})

	h.register("environment", "get_version", func(_ json.RawMessage) (any, error) {
		return map[string]any{
			"version": appVersion,
			"dev":     devMode,
		}, nil
	})

	h.register("environment", "get_licenses", func(_ json.RawMessage) (any, error) {
		return map[string]string{
			"app":        brender.AppLicense,
			"thirdParty": brender.ThirdPartyLicenses,
		}, nil
	})
}

// ── Blender ─────────────────────────────────────────────

func (h *Handler) registerBlender() {
	h.register("blender", "list", func(_ json.RawMessage) (any, error) {
		return api.ListBlenders()
	})

	h.register("blender", "register", func(body json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.RegisterBlender(p.Path)
	})

	h.register("blender", "delete", func(body json.RawMessage) (any, error) {
		var p struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteBlender(p.ID)
	})

	h.register("blender", "reorder", func(body json.RawMessage) (any, error) {
		var p struct {
			IDs []uint `json:"ids"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.ReorderBlenders(p.IDs)
	})

	h.register("blender", "get_engines", func(body json.RawMessage) (any, error) {
		var p struct {
			InstallID uint `json:"install_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetEngines(p.InstallID)
	})

	h.register("blender", "get_scenes", func(body json.RawMessage) (any, error) {
		var p struct {
			InstallID uint   `json:"install_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetScenes(p.InstallID, p.FileID)
	})

	h.register("blender", "get_cameras", func(body json.RawMessage) (any, error) {
		var p struct {
			InstallID uint   `json:"install_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetCameras(p.InstallID, p.FileID)
	})

	h.register("blender", "get_tool_data", func(body json.RawMessage) (any, error) {
		var p struct {
			InstallID uint   `json:"install_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetToolData(p.InstallID, p.FileID)
	})

	h.register("blender", "get_cpu_count", func(_ json.RawMessage) (any, error) {
		return runtime.NumCPU(), nil
	})

	h.register("blender", "open_file", func(body json.RawMessage) (any, error) {
		var p struct {
			InstallID uint   `json:"install_id"`
			FilePath  string `json:"file_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.OpenBlenderFile(p.InstallID, p.FilePath)
	})
}

// ── Project ─────────────────────────────────────────────

func (h *Handler) registerProject() {
	h.register("project", "list", func(body json.RawMessage) (any, error) {
		var p struct {
			Sort string `json:"sort"`
			Dir  string `json:"dir"`
		}
		json.Unmarshal(body, &p)
		return api.ListProjects(p.Sort, p.Dir)
	})

	h.register("project", "get", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetProject(p.ID)
	})

	h.register("project", "create", func(body json.RawMessage) (any, error) {
		var p struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateProject(p.Name)
	})

	h.register("project", "update", func(body json.RawMessage) (any, error) {
		var p struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Note string `json:"note"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateProject(p.ID, p.Name, p.Note)
	})

	h.register("project", "delete", func(body json.RawMessage) (any, error) {
		var p struct {
			ID    string `json:"id"`
			Force bool   `json:"force"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteProject(p.ID, p.Force)
	})

	h.register("project", "add_file", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			Path      string `json:"path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.AddProjectFile(p.ProjectID, p.Path)
	})

	h.register("project", "list_all_files", func(_ json.RawMessage) (any, error) {
		return api.ListAllProjectFiles()
	})

	h.register("project", "get_file", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetFile(p.FileID)
	})

	h.register("project", "update_file", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID           string `json:"file_id"`
			Name             string `json:"name"`
			Note             string `json:"note"`
			BlenderInstallID uint   `json:"blender_install_id"`
			BlenderFixed     bool   `json:"blender_fixed"`
			Scene            string `json:"scene"`
			SceneFixed       bool   `json:"scene_fixed"`
			Camera           string `json:"camera"`
			CameraFixed      bool   `json:"camera_fixed"`
			Engine           string `json:"engine"`
			EngineFixed      bool   `json:"engine_fixed"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateProjectFile(p.FileID, p.Name, p.Note, p.BlenderInstallID, p.BlenderFixed, p.Scene, p.SceneFixed, p.Camera, p.CameraFixed, p.Engine, p.EngineFixed)
	})

	h.register("project", "add_files_from_dir", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			Dir       string `json:"dir"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.AddFilesFromDirectory(p.ProjectID, p.Dir)
	})

	h.register("project", "remove_file", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.RemoveProjectFile(p.FileID)
	})

	h.register("project", "delete_file", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID string `json:"file_id"`
			Force  bool   `json:"force"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteProjectFile(p.FileID, p.Force)
	})

	h.register("project", "get_file_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetFileThumbnail(p.ProjectID, p.FileID)
	})

	h.register("project", "get_project_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetProjectThumbnail(p.ProjectID)
	})

	h.register("project", "set_project_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			ImagePath string `json:"image_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SetProjectThumbnail(p.ProjectID, p.ImagePath)
	})

	h.register("project", "set_file_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			FileID    string `json:"file_id"`
			ImagePath string `json:"image_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SetFileThumbnail(p.ProjectID, p.FileID, p.ImagePath)
	})

	h.register("project", "set_file_thumbnail_from_workspace", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			FileID      string `json:"file_id"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SetFileThumbnailFromWorkspace(p.ProjectID, p.FileID, p.WorkspaceID)
	})

	h.register("project", "set_project_thumbnail_from_file", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SetProjectThumbnailFromFile(p.ProjectID, p.FileID)
	})

	// ── Permission ──────────────────────────────────────

	h.register("project", "set_permission", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			TargetID  string `json:"target_id"`
			Role      string `json:"role"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetProjectPermission(p.ProjectID, p.TargetID, p.Role)
	})

	h.register("project", "remove_permission", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			TargetID  string `json:"target_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.RemoveProjectPermission(p.ProjectID, p.TargetID)
	})

	h.register("project", "list_permissions", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListProjectPermissions(p.ProjectID)
	})

	h.register("project", "get_user_role", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			UserID    string `json:"user_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetUserProjectRole(p.ProjectID, p.UserID)
	})

	// ── File Permission ─────────────────────────────────

	h.register("project", "set_file_permission", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID   string `json:"file_id"`
			TargetID string `json:"target_id"`
			Role     string `json:"role"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.SetFilePermission(p.FileID, p.TargetID, p.Role)
	})

	h.register("project", "remove_file_permission", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID   string `json:"file_id"`
			TargetID string `json:"target_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.RemoveFilePermission(p.FileID, p.TargetID)
	})

	h.register("project", "list_file_permissions", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListFilePermissions(p.FileID)
	})

	h.register("project", "get_user_file_role", func(body json.RawMessage) (any, error) {
		var p struct {
			FileID string `json:"file_id"`
			UserID string `json:"user_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetUserFileRole(p.FileID, p.UserID)
	})
}

// ── Workspace ───────────────────────────────────────────

func (h *Handler) registerWorkspace() {
	h.register("workspace", "list_by_project", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			Sort      string `json:"sort"`
			Dir       string `json:"dir"`
		}
		json.Unmarshal(body, &p)
		return api.ListWorkspacesByProject(p.ProjectID, p.Sort, p.Dir)
	})

	h.register("workspace", "get", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetWorkspace(p.ProjectID, p.WorkspaceID)
	})

	h.register("workspace", "create", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID     string `json:"project_id"`
			ProjectFileID string `json:"project_file_id"`
			Name          string `json:"name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateWorkspace(p.ProjectID, p.ProjectFileID, p.Name)
	})

	h.register("workspace", "create_batch", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID     string                   `json:"project_id"`
			ProjectFileID string                   `json:"project_file_id"`
			Specs         []api.WorkspaceBatchSpec  `json:"specs"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateWorkspaceBatch(p.ProjectID, p.ProjectFileID, p.Specs)
	})

	h.register("workspace", "copy", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
			NewName     string `json:"new_name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CopyWorkspace(p.ProjectID, p.WorkspaceID, p.NewName)
	})

	h.register("workspace", "update", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID        string `json:"project_id"`
			WorkspaceID      string `json:"workspace_id"`
			Name             string `json:"name"`
			Note             string `json:"note"`
			BlenderInstallID uint   `json:"blender_install_id"`
			Scene            string `json:"scene"`
			Camera           string `json:"camera"`
			Engine           string `json:"engine"`
			StartFrame       int    `json:"start_frame"`
			EndFrame         int    `json:"end_frame"`
			FrameStep        int    `json:"frame_step"`
			Thread           int    `json:"thread"`
			Samples          int    `json:"samples"`
			ResolutionX      int    `json:"resolution_x"`
			ResolutionY      int    `json:"resolution_y"`
			OutputFormat     string `json:"output_format"`
			AutoLock         bool   `json:"auto_lock"`
			AutoLockMinSize  int64  `json:"auto_lock_min_size"`
			AutoLockKeep     int    `json:"auto_lock_keep"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateWorkspace(p.ProjectID, p.WorkspaceID, p.Name, p.Note, p.BlenderInstallID, p.Scene, p.Camera, p.Engine, p.StartFrame, p.EndFrame, p.FrameStep, p.Thread, p.Samples, p.ResolutionX, p.ResolutionY, p.OutputFormat, p.AutoLock, p.AutoLockMinSize, p.AutoLockKeep)
	})

	h.register("workspace", "delete", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
			Force       bool   `json:"force"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteWorkspace(p.ProjectID, p.WorkspaceID, p.Force)
	})

	h.register("workspace", "get_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			FileID      string `json:"file_id"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetWorkspaceThumbnail(p.ProjectID, p.FileID, p.WorkspaceID)
	})

	h.register("workspace", "set_thumbnail", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			FileID      string `json:"file_id"`
			WorkspaceID string `json:"workspace_id"`
			ImagePath   string `json:"image_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SetWorkspaceThumbnail(p.ProjectID, p.FileID, p.WorkspaceID, p.ImagePath)
	})

	h.register("workspace", "create_movie", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			FileID      string `json:"file_id"`
			WorkspaceID string `json:"workspace_id"`
			JobID       string `json:"job_id"`
			FPS         int    `json:"fps"`
			OutExt      string `json:"outext"`
			ExtraArgs   string `json:"extra_args"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		path, ch, err := api.CreateMovie(p.ProjectID, p.FileID, p.WorkspaceID, p.JobID, p.FPS, p.OutExt, p.ExtraArgs)
		if err != nil {
			return nil, err
		}
		// Wails 版と同じく非同期で完了を待ち、フック経由で通知する
		go func() {
			errMsg := ""
			if err := <-ch; err != nil {
				errMsg = err.Error()
			}
			if api.MovieCreatedHook != nil {
				api.MovieCreatedHook(p.JobID, path, errMsg)
			}
		}()
		return nil, nil
	})
}

// ── Queue ───────────────────────────────────────────────

func (h *Handler) registerQueue() {
	h.register("queue", "preview_render", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.PreviewRender(p.ProjectID, p.WorkspaceID)
	})

	h.register("queue", "enqueue_with_preview", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string             `json:"project_id"`
			WorkspaceID string             `json:"workspace_id"`
			Preview     *api.RenderPreview `json:"preview"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.EnqueueWithPreview(p.ProjectID, p.WorkspaceID, p.Preview)
	})

	h.register("queue", "test_enqueue", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string               `json:"project_id"`
			WorkspaceID string               `json:"workspace_id"`
			Params      api.TestRenderParams `json:"params"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.TestEnqueue(p.ProjectID, p.WorkspaceID, p.Params)
	})

	h.register("queue", "samples_comparison_enqueue", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID    string `json:"project_id"`
			WorkspaceID  string `json:"workspace_id"`
			SampleCounts []int  `json:"sample_counts"`
			Frame        int    `json:"frame"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.SamplesComparisonEnqueue(p.ProjectID, p.WorkspaceID, p.SampleCounts, p.Frame)
	})

	h.register("queue", "list", func(_ json.RawMessage) (any, error) {
		return api.ListQueues()
	})

	h.register("queue", "list_items", func(_ json.RawMessage) (any, error) {
		return api.ListQueueItems()
	})

	h.register("queue", "cancel", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.CancelQueue(p.ID)
	})

	h.register("queue", "kill_running", func(_ json.RawMessage) (any, error) {
		api.KillRunningQueues()
		return nil, nil
	})

	h.register("queue", "list_jobs", func(_ json.RawMessage) (any, error) {
		return api.ListJobs()
	})

	h.register("queue", "list_jobs_paged", func(body json.RawMessage) (any, error) {
		var p struct {
			Filter   *model.JobFilter `json:"filter"`
			Page     int              `json:"page"`
			PageSize int              `json:"page_size"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobsPaged(p.Filter, p.Page, p.PageSize)
	})

	h.register("queue", "list_jobs_by_workspace", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobsByWorkspace(p.ProjectID, p.WorkspaceID)
	})

	h.register("queue", "list_jobs_by_workspace_paged", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
			Page        int    `json:"page"`
			PageSize    int    `json:"page_size"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobsByWorkspacePaged(p.ProjectID, p.WorkspaceID, p.Page, p.PageSize)
	})

	h.register("queue", "list_jobs_by_project_file", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			FileID    string `json:"file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobsByProjectFile(p.ProjectID, p.FileID)
	})

	h.register("queue", "list_jobs_by_project_file_paged", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
			FileID    string `json:"file_id"`
			Page      int    `json:"page"`
			PageSize  int    `json:"page_size"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobsByProjectFilePaged(p.ProjectID, p.FileID, p.Page, p.PageSize)
	})

	h.register("queue", "get_job", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return model.GetJob(p.ID)
	})

	h.register("queue", "update_job_meta", func(body json.RawMessage) (any, error) {
		var p struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Note string `json:"note"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.UpdateJobMeta(p.ID, p.Name, p.Note)
	})

	h.register("queue", "delete_job", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteJob(p.ID)
	})

	h.register("queue", "delete_job_data", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteJobData(p.ID)
	})

	h.register("queue", "list_job_images", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobImages(p.ID)
	})

	h.register("queue", "list_job_files", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListJobFiles(p.ID)
	})

	h.register("queue", "get_image_base64", func(body json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetImageBase64(p.Path)
	})

	h.register("queue", "lock_job", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.LockJob(p.ID)
	})

	h.register("queue", "unlock_job", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.UnlockJob(p.ID)
	})

	h.register("queue", "get_job_log", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetJobLog(p.ID)
	})

	h.register("queue", "zip_job_data", func(body json.RawMessage) (any, error) {
		var p struct {
			ID       string `json:"id"`
			SavePath string `json:"save_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.ZipJobData(p.ID, p.SavePath)
	})

	h.register("queue", "zip_job_selected_files", func(body json.RawMessage) (any, error) {
		var p struct {
			ID        string   `json:"id"`
			FilePaths []string `json:"file_paths"`
			SavePath  string   `json:"save_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.ZipJobSelectedFiles(p.ID, p.FilePaths, p.SavePath)
	})

	h.register("queue", "delete_job_files", func(body json.RawMessage) (any, error) {
		var p struct {
			ID        string   `json:"id"`
			FilePaths []string `json:"file_paths"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteJobFiles(p.ID, p.FilePaths)
	})

	h.register("queue", "bulk_delete_jobs_by_workspace", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID   string `json:"project_id"`
			WorkspaceID string `json:"workspace_id"`
			KeepCount   int    `json:"keep_count"`
			DataOnly    bool   `json:"data_only"`
			ErrorOnly   bool   `json:"error_only"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.BulkDeleteJobsByWorkspace(p.ProjectID, p.WorkspaceID, p.KeepCount, p.DataOnly, p.ErrorOnly)
	})

	h.register("queue", "get_cleanable_job_stats", func(body json.RawMessage) (any, error) {
		var p struct {
			Filter *model.CleanFilter `json:"filter"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetCleanableJobStats(p.Filter)
	})

	h.register("queue", "clean_job_data", func(body json.RawMessage) (any, error) {
		var p struct {
			Filter *model.CleanFilter `json:"filter"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CleanJobData(p.Filter)
	})

	h.register("queue", "measure_filtered_disk_size", func(body json.RawMessage) (any, error) {
		var p struct {
			Filter *model.CleanFilter `json:"filter"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.MeasureFilteredDiskSize(p.Filter)
	})
}

// ── WorkDir ─────────────────────────────────────────────

func (h *Handler) registerWorkDir() {
	h.register("work_dir", "list", func(_ json.RawMessage) (any, error) {
		return api.ListWorkDirs()
	})

	h.register("work_dir", "create", func(body json.RawMessage) (any, error) {
		var p struct {
			Path     string `json:"path"`
			Priority int    `json:"priority"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateWorkDir(p.Path, p.Priority)
	})

	h.register("work_dir", "update", func(body json.RawMessage) (any, error) {
		var p struct {
			ID       uint   `json:"id"`
			Path     string `json:"path"`
			Priority int    `json:"priority"`
			Status   string `json:"status"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateWorkDir(p.ID, p.Path, p.Priority, p.Status)
	})

	h.register("work_dir", "reorder", func(body json.RawMessage) (any, error) {
		var p struct {
			IDs []uint `json:"ids"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.ReorderWorkDirs(p.IDs)
	})

	h.register("work_dir", "delete", func(body json.RawMessage) (any, error) {
		var p struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteWorkDir(p.ID)
	})

	h.register("work_dir", "check_dir", func(body json.RawMessage) (any, error) {
		var p struct {
			Path string `json:"path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CheckWorkDir(p.Path)
	})

	h.register("work_dir", "start_migration", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID    string `json:"project_id"`
			NewWorkDirID uint   `json:"new_work_dir_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.StartMigrateProjectWorkDir(p.ProjectID, p.NewWorkDirID)
	})

	h.register("work_dir", "get_work_dir_stats", func(body json.RawMessage) (any, error) {
		var p struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetWorkDirStats(p.ID)
	})

	h.register("work_dir", "change_dir", func(body json.RawMessage) (any, error) {
		var p struct {
			ID      uint   `json:"id"`
			NewPath string `json:"new_path"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.StartChangeWorkDir(p.ID, p.NewPath)
	})

	h.register("work_dir", "get_project_disk_size", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetProjectDiskSize(p.ProjectID)
	})
}

// ── Codes ───────────────────────────────────────────────

func (h *Handler) registerCodes() {
	h.register("codes", "get_image_formats", func(_ json.RawMessage) (any, error) {
		return code.GetImageFormats()
	})

	h.register("codes", "get_video_formats", func(_ json.RawMessage) (any, error) {
		return code.GetVideoFormats()
	})

	h.register("codes", "get_resolution_presets", func(_ json.RawMessage) (any, error) {
		return code.GetResolutionPresets()
	})

	h.register("codes", "save_image_formats", func(body json.RawMessage) (any, error) {
		var p struct {
			Items []code.ImageFormat `json:"items"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, code.SaveImageFormats(p.Items)
	})

	h.register("codes", "save_video_formats", func(body json.RawMessage) (any, error) {
		var p struct {
			Items []code.VideoFormat `json:"items"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, code.SaveVideoFormats(p.Items)
	})

	h.register("codes", "save_resolution_presets", func(body json.RawMessage) (any, error) {
		var p struct {
			Items []code.ResolutionPreset `json:"items"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, code.SaveResolutionPresets(p.Items)
	})

	h.register("codes", "generate_id", func(_ json.RawMessage) (any, error) {
		id, err := uuid.NewV7()
		if err != nil {
			return nil, err
		}
		return id.String(), nil
	})

	h.register("codes", "reset_image_formats", func(_ json.RawMessage) (any, error) {
		return nil, code.ResetImageFormats()
	})

	h.register("codes", "reset_video_formats", func(_ json.RawMessage) (any, error) {
		return nil, code.ResetVideoFormats()
	})

	h.register("codes", "reset_resolution_presets", func(_ json.RawMessage) (any, error) {
		return nil, code.ResetResolutionPresets()
	})
}

// ── Tag ─────────────────────────────────────────────────

func (h *Handler) registerTag() {
	h.register("tag", "list_categories", func(_ json.RawMessage) (any, error) {
		return api.ListTagCategories()
	})

	h.register("tag", "create_category", func(body json.RawMessage) (any, error) {
		var p struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateTagCategory(p.Name, p.Color)
	})

	h.register("tag", "update_category", func(body json.RawMessage) (any, error) {
		var p struct {
			ID    uint   `json:"id"`
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateTagCategory(p.ID, p.Name, p.Color)
	})

	h.register("tag", "delete_category", func(body json.RawMessage) (any, error) {
		var p struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteTagCategory(p.ID)
	})

	h.register("tag", "reorder_categories", func(body json.RawMessage) (any, error) {
		var p struct {
			IDs []uint `json:"ids"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.ReorderTagCategories(p.IDs)
	})

	h.register("tag", "merge_categories", func(body json.RawMessage) (any, error) {
		var p struct {
			SourceID uint `json:"source_id"`
			TargetID uint `json:"target_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.MergeTagCategories(p.SourceID, p.TargetID)
	})

	h.register("tag", "list_tags", func(_ json.RawMessage) (any, error) {
		return api.ListTags()
	})

	h.register("tag", "create_tag", func(body json.RawMessage) (any, error) {
		var p struct {
			Name       string `json:"name"`
			CategoryID uint   `json:"category_id"`
			Color      string `json:"color"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		var cid *uint
		if p.CategoryID > 0 {
			cid = &p.CategoryID
		}
		return api.CreateTag(p.Name, cid, p.Color)
	})

	h.register("tag", "update_tag", func(body json.RawMessage) (any, error) {
		var p struct {
			ID         uint   `json:"id"`
			Name       string `json:"name"`
			CategoryID uint   `json:"category_id"`
			Color      string `json:"color"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		var cid *uint
		if p.CategoryID > 0 {
			cid = &p.CategoryID
		}
		return api.UpdateTag(p.ID, p.Name, cid, p.Color)
	})

	h.register("tag", "delete_tag", func(body json.RawMessage) (any, error) {
		var p struct {
			ID uint `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteTag(p.ID)
	})

	h.register("tag", "set_tag_category", func(body json.RawMessage) (any, error) {
		var p struct {
			TagID      uint `json:"tag_id"`
			CategoryID uint `json:"category_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		var cid *uint
		if p.CategoryID > 0 {
			cid = &p.CategoryID
		}
		return nil, api.SetTagCategory(p.TagID, cid)
	})

	h.register("tag", "merge_tags", func(body json.RawMessage) (any, error) {
		var p struct {
			SourceID uint `json:"source_id"`
			TargetID uint `json:"target_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.MergeTags(p.SourceID, p.TargetID)
	})

	h.register("tag", "add_tag_to_file", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectFileID string `json:"project_file_id"`
			TagID         uint   `json:"tag_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.AddTagToFile(p.ProjectFileID, p.TagID)
	})

	h.register("tag", "remove_tag_from_file", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectFileID string `json:"project_file_id"`
			TagID         uint   `json:"tag_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.RemoveTagFromFile(p.ProjectFileID, p.TagID)
	})

	h.register("tag", "get_file_tags", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectFileID string `json:"project_file_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetFileTags(p.ProjectFileID)
	})

	h.register("tag", "assign_tag_by_input", func(body json.RawMessage) (any, error) {
		var p struct {
			ProjectFileID string `json:"project_file_id"`
			Input         string `json:"input"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.AssignTagByInput(p.ProjectFileID, p.Input)
	})

	h.register("tag", "search_files", func(body json.RawMessage) (any, error) {
		var p struct {
			TagIDs   []uint `json:"tag_ids"`
			Page     int    `json:"page"`
			PageSize int    `json:"page_size"`
			Sort     string `json:"sort"`
			Dir      string `json:"dir"`
			Untagged bool   `json:"untagged"`
			Keyword  string `json:"keyword"`
		}
		json.Unmarshal(body, &p)
		if p.Page < 1 {
			p.Page = 1
		}
		if p.PageSize < 1 {
			p.PageSize = 20
		}
		return api.SearchFiles(p.TagIDs, p.Page, p.PageSize, p.Sort, p.Dir, p.Untagged, p.Keyword)
	})

	h.register("tag", "list_tag_usage_counts", func(_ json.RawMessage) (any, error) {
		return api.ListTagUsageCounts()
	})
}

// ── Auth ───────────────────────────────────────────────────

func (h *Handler) registerAuth() {
	h.register("auth", "list_users", func(_ json.RawMessage) (any, error) {
		return api.ListUsers()
	})

	h.register("auth", "get_user", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetUser(p.ID)
	})

	h.register("auth", "create_user", func(body json.RawMessage) (any, error) {
		var p struct {
			Name        string `json:"name"`
			DisplayName string `json:"display_name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateUser(p.Name, p.DisplayName)
	})

	h.register("auth", "update_user", func(body json.RawMessage) (any, error) {
		var p struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			DisplayName string `json:"display_name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateUser(p.ID, p.Name, p.DisplayName)
	})

	h.register("auth", "delete_user", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteUser(p.ID)
	})

	h.register("auth", "list_groups", func(_ json.RawMessage) (any, error) {
		return api.ListGroups()
	})

	h.register("auth", "get_group", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.GetGroup(p.ID)
	})

	h.register("auth", "create_group", func(body json.RawMessage) (any, error) {
		var p struct {
			Name        string `json:"name"`
			DisplayName string `json:"display_name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.CreateGroup(p.Name, p.DisplayName)
	})

	h.register("auth", "update_group", func(body json.RawMessage) (any, error) {
		var p struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			DisplayName string `json:"display_name"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.UpdateGroup(p.ID, p.Name, p.DisplayName)
	})

	h.register("auth", "delete_group", func(body json.RawMessage) (any, error) {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.DeleteGroup(p.ID)
	})

	h.register("auth", "list_groups_by_user", func(body json.RawMessage) (any, error) {
		var p struct {
			UserID string `json:"user_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListGroupsByUser(p.UserID)
	})

	h.register("auth", "list_users_by_group", func(body json.RawMessage) (any, error) {
		var p struct {
			GroupID string `json:"group_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return api.ListUsersByGroup(p.GroupID)
	})

	h.register("auth", "add_user_to_group", func(body json.RawMessage) (any, error) {
		var p struct {
			UserID  string `json:"user_id"`
			GroupID string `json:"group_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.AddUserToGroup(p.UserID, p.GroupID)
	})

	h.register("auth", "remove_user_from_group", func(body json.RawMessage) (any, error) {
		var p struct {
			UserID  string `json:"user_id"`
			GroupID string `json:"group_id"`
		}
		if err := json.Unmarshal(body, &p); err != nil {
			return nil, err
		}
		return nil, api.RemoveUserFromGroup(p.UserID, p.GroupID)
	})
}
