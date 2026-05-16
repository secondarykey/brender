package api

import (
	"archive/zip"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

func getMaxConcurrentJobs() int64 {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.MaxConcurrentJobs <= 0 {
		return 1
	}
	return int64(env.MaxConcurrentJobs)
}

// scheduleMu はキューの起動判定と DB 更新をアトミックに行うためのミューテックス。
var scheduleMu sync.Mutex

// QueueChangedHook はキューの件数が変化したときに呼ばれるフック。
// 呼び出し元（Wails サービス層など）で設定する。
var QueueChangedHook func(count int64)

func notifyQueueChanged() {
	if QueueChangedHook == nil {
		return
	}
	count, _ := model.CountQueues()
	QueueChangedHook(count)
}

// RenderPreview はレンダリング実行前に解決された確定パラメータ
type RenderPreview struct {
	ProjectName   string `json:"project_name"`
	WorkspaceName string `json:"workspace_name"`
	ProjectFileID string `json:"project_file_id"`
	BlenderPath   string `json:"blender_path"`
	BlenderFile   string `json:"blender_file"`
	Scene         string `json:"scene"`
	Engine        string `json:"engine"`
	StartFrame    int    `json:"start_frame"`
	EndFrame      int    `json:"end_frame"`
	FrameStep     int    `json:"frame_step"`
	Thread        int    `json:"thread"`
	Samples       int    `json:"samples"`
	ResolutionX   int    `json:"resolution_x"`
	ResolutionY   int    `json:"resolution_y"`
	Camera        string `json:"camera"`
	OutputFormat  string `json:"output_format"` // 解決済みフォーマット名（"PNG" / "JPEG"）
}

// PreviewRender はToolを実行してレンダリングパラメータを解決・検証する。
// シーン名が存在しない場合などはここでエラーを返す。
func PreviewRender(projectID, workspaceID string) (*RenderPreview, error) {
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return nil, xerrors.Errorf("workspace not found: %w", err)
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return nil, xerrors.Errorf("project not found: %w", err)
	}

	var fileBlenderID uint
	var fileBlenderFixed bool
	var fileScene string
	var fileSceneFixed bool
	var fileCamera string
	var fileCameraFixed bool
	var fileEngine string
	var fileEngineFixed bool
	if w.ProjectFileID != "" {
		pf, pfErr := model.GetProjectFile(w.ProjectFileID)
		if pfErr == nil && pf != nil {
			fileBlenderID = pf.BlenderInstallID
			fileBlenderFixed = pf.BlenderFixed
			fileScene = pf.Scene
			fileSceneFixed = pf.SceneFixed
			fileCamera = pf.Camera
			fileCameraFixed = pf.CameraFixed
			fileEngine = pf.Engine
			fileEngineFixed = pf.EngineFixed
		}
	}

	// Blender: 固定フラグありファイル指定はワークスペース設定を無視
	wsBlenderID := w.BlenderInstallID
	if fileBlenderFixed && fileBlenderID != 0 {
		wsBlenderID = fileBlenderID
	}
	blenderPath, err := resolveBlenderPath(wsBlenderID, fileBlenderID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderPath: %w", err)
	}
	blenderFile, err := resolveBlenderFile(w.ProjectFileID, projectID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderFile: %w", err)
	}

	// シーン: 固定フラグありファイル指定 → ワークスペース指定 → ファイル指定
	var scene string
	if fileSceneFixed && fileScene != "" {
		scene = fileScene
	} else if w.Scene != "" {
		scene = w.Scene
	} else {
		scene = fileScene
	}

	// Tool を実行してシーンを検証し、フレーム範囲を取得
	st, toolErr := exec.ResolveScene(blenderPath, blenderFile, scene)
	if toolErr != nil {
		return nil, xerrors.Errorf("レンダリング前検証エラー: %w", toolErr)
	}

	// フレーム範囲: 未指定 (0,-1) はツール結果を使用、明示指定はそのまま
	startFrame := w.StartFrame
	endFrame := w.EndFrame
	if startFrame == 0 && endFrame == -1 {
		startFrame = st.Start
		endFrame = st.End
	}

	// エンジン: 固定フラグありファイル指定 → ワークスペース指定 → ファイル指定 → シーンのデフォルト
	var engine string
	if fileEngineFixed && fileEngine != "" {
		engine = fileEngine
	} else if w.Engine != "" {
		engine = w.Engine
	} else if fileEngine != "" {
		engine = fileEngine
	} else {
		engine = st.Engine
	}

	// カメラ: 固定フラグありファイル指定 → ワークスペース指定 → ファイル指定 → シーンのデフォルト
	var camera string
	if fileCameraFixed && fileCamera != "" {
		camera = fileCamera
	} else if w.Camera != "" {
		camera = w.Camera
	} else if fileCamera != "" {
		camera = fileCamera
	} else {
		camera = st.Camera
	}

	samples := w.Samples
	if samples == 0 {
		samples = st.SamplesForEngine(engine)
	}

	// フォーマット: ワークスペース指定 → システムデフォルト → "PNG"
	outputFormat := w.OutputFormat
	if outputFormat == "" {
		if env, envErr := model.GetEnv(); envErr == nil && env != nil && env.OutputFormat != "" {
			outputFormat = env.OutputFormat
		} else {
			outputFormat = "PNG"
		}
	}

	return &RenderPreview{
		ProjectName:   p.Name,
		WorkspaceName: w.Name,
		ProjectFileID: w.ProjectFileID,
		BlenderPath:   blenderPath,
		BlenderFile:   blenderFile,
		Scene:         st.Name, // 常に実際のシーン名
		Engine:        engine,
		StartFrame:    startFrame,
		EndFrame:      endFrame,
		FrameStep:     w.FrameStep,
		Thread:        w.Thread,
		Samples:       samples,
		ResolutionX:   w.ResolutionX,
		ResolutionY:   w.ResolutionY,
		Camera:        camera,
		OutputFormat:  outputFormat,
	}, nil
}

// TestRenderParams はテストレンダリングのインラインパラメータ（ワークスペースへの保存は行わない）
type TestRenderParams struct {
	BlenderInstallID uint   `json:"blender_install_id"`
	Scene            string `json:"scene"`
	Camera           string `json:"camera"`
	Engine           string `json:"engine"`
	StartFrame       int    `json:"start_frame"`
	EndFrame         int    `json:"end_frame"`
	Thread           int    `json:"thread"`
	ResolutionX      int    `json:"resolution_x"`
	ResolutionY      int    `json:"resolution_y"`
}

// TestEnqueue は現在のフォーム値でサンプル8・中間1フレームのテストレンダリングをキューに追加する。
// ワークスペースへの保存は行わない。
func TestEnqueue(projectID, workspaceID string, params TestRenderParams) (*model.Queue, error) {
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return nil, xerrors.Errorf("workspace not found: %w", err)
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return nil, xerrors.Errorf("project not found: %w", err)
	}

	var fileBlenderID uint
	var fileBlenderFixed bool
	var fileScene string
	var fileSceneFixed bool
	var fileCamera string
	var fileCameraFixed bool
	var fileEngine string
	var fileEngineFixed bool
	if w.ProjectFileID != "" {
		pf, pfErr := model.GetProjectFile(w.ProjectFileID)
		if pfErr == nil && pf != nil {
			fileBlenderID = pf.BlenderInstallID
			fileBlenderFixed = pf.BlenderFixed
			fileScene = pf.Scene
			fileSceneFixed = pf.SceneFixed
			fileCamera = pf.Camera
			fileCameraFixed = pf.CameraFixed
			fileEngine = pf.Engine
			fileEngineFixed = pf.EngineFixed
		}
	}

	wsBlenderID := params.BlenderInstallID
	if fileBlenderFixed && fileBlenderID != 0 {
		wsBlenderID = fileBlenderID
	}
	blenderPath, err := resolveBlenderPath(wsBlenderID, fileBlenderID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderPath: %w", err)
	}
	blenderFile, err := resolveBlenderFile(w.ProjectFileID, projectID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderFile: %w", err)
	}

	var scene string
	if fileSceneFixed && fileScene != "" {
		scene = fileScene
	} else if params.Scene != "" {
		scene = params.Scene
	} else {
		scene = fileScene
	}

	st, toolErr := exec.ResolveScene(blenderPath, blenderFile, scene)
	if toolErr != nil {
		return nil, xerrors.Errorf("レンダリング前検証エラー: %w", toolErr)
	}

	// フレーム範囲: 未指定 (0,-1) はシーンのデフォルトを使用
	startFrame := params.StartFrame
	endFrame := params.EndFrame
	if startFrame == 0 && endFrame == -1 {
		startFrame = st.Start
		endFrame = st.End
	}

	// 中間フレーム1枚のみレンダリング
	testFrame := (startFrame + endFrame) / 2

	// エンジン: 固定フラグありファイル指定 → params指定 → ファイル指定 → シーンのデフォルト
	var engine string
	if fileEngineFixed && fileEngine != "" {
		engine = fileEngine
	} else if params.Engine != "" {
		engine = params.Engine
	} else if fileEngine != "" {
		engine = fileEngine
	} else {
		engine = st.Engine
	}

	// カメラ: 固定フラグありファイル指定 → params指定 → ファイル指定 → シーンのデフォルト
	var camera string
	if fileCameraFixed && fileCamera != "" {
		camera = fileCamera
	} else if params.Camera != "" {
		camera = params.Camera
	} else if fileCamera != "" {
		camera = fileCamera
	} else {
		camera = st.Camera
	}

	preview := &RenderPreview{
		ProjectName:   p.Name,
		WorkspaceName: w.Name + " (Test)",
		ProjectFileID: w.ProjectFileID,
		BlenderPath:   blenderPath,
		BlenderFile:   blenderFile,
		Scene:         st.Name,
		Engine:        engine,
		StartFrame:    testFrame,
		EndFrame:      testFrame,
		FrameStep:     1,
		Thread:        params.Thread,
		Samples:       8,
		ResolutionX:   params.ResolutionX,
		ResolutionY:   params.ResolutionY,
		Camera:        camera,
	}

	return EnqueueWithPreview(projectID, workspaceID, preview)
}

// EnqueueWithPreview は解決済みの RenderPreview を使ってジョブを作成・実行する。
func EnqueueWithPreview(projectID, workspaceID string, preview *RenderPreview) (*model.Queue, error) {
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return nil, xerrors.Errorf("GetProjectBaseDir: %w", err)
	}

	// Lock チェック
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return nil, xerrors.Errorf("project not found: %w", err)
	}
	wd, err := model.GetWorkDir(p.WorkDirID)
	if err != nil || wd == nil {
		return nil, xerrors.New("作業ディレクトリが設定されていません")
	}
	if wd.Status == model.WorkDirStatusLock {
		return nil, xerrors.New("作業ディレクトリがロックされています。移行後に実行してください")
	}

	exists, err := model.ExistsQueueByWorkspace(projectID, workspaceID)
	if err != nil {
		return nil, xerrors.Errorf("ExistsQueueByWorkspace: %w", err)
	}
	if exists {
		return nil, xerrors.New("同一ワークスペースのジョブがすでにキューに存在します")
	}

	id, err := model.NewQueueID()
	if err != nil {
		return nil, xerrors.Errorf("NewQueueID: %w", err)
	}

	outputDir := filepath.Join(baseDir, projectID, preview.ProjectFileID, workspaceID, id)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, xerrors.Errorf("MkdirAll: %w", err)
	}

	now := time.Now()

	job := &model.Job{
		ID:            id,
		Name:          fmt.Sprintf("%s(%d-%d)", preview.WorkspaceName, preview.StartFrame, preview.EndFrame),
		ProjectID:     projectID,
		ProjectName:   preview.ProjectName,
		WorkspaceID:   workspaceID,
		WorkspaceName: preview.WorkspaceName,
		ProjectFileID: preview.ProjectFileID,
		BlenderPath:   preview.BlenderPath,
		BlenderFile:   preview.BlenderFile,
		OutputDir:     outputDir,
		Scene:         preview.Scene,
		Engine:        preview.Engine,
		StartFrame:    preview.StartFrame,
		EndFrame:      preview.EndFrame,
		FrameStep:     preview.FrameStep,
		Thread:        preview.Thread,
		Samples:       preview.Samples,
		ResolutionX:   preview.ResolutionX,
		ResolutionY:   preview.ResolutionY,
		Camera:        preview.Camera,
		OutputExt:     exec.FormatToExt(preview.OutputFormat),
		EnqueuedAt:    &now,
	}
	if err := model.CreateJob(job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
	}

	// ワークスペース・ファイル・プロジェクトのデータ処理日を更新
	if err := model.UpdateWorkspaceProcessedAt(workspaceID, &now); err != nil {
		log.Println("UpdateWorkspaceProcessedAt:", err)
	}
	if err := model.UpdateProjectFileProcessedAt(preview.ProjectFileID, &now); err != nil {
		log.Println("UpdateProjectFileProcessedAt:", err)
	}
	if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
		log.Println("UpdateProjectProcessedAt:", err)
	}

	q := &model.Queue{
		ID:          id,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		Status:      model.QueueWaiting,
	}
	if err := model.CreateQueue(q); err != nil {
		return nil, xerrors.Errorf("CreateQueue: %w", err)
	}

	// 同時実行数が上限未満なら即時起動、超えていれば待機キューのまま
	scheduleMu.Lock()
	running, _ := model.CountRunningQueues()
	shouldStart := running < getMaxConcurrentJobs()
	if shouldStart {
		_ = model.MarkQueueStarting(id)
	}
	scheduleMu.Unlock()

	if shouldStart {
		go executeQueue(q, job)
	}
	notifyQueueChanged()

	return q, nil
}

// Enqueue は PreviewRender + EnqueueWithPreview のショートカット（後方互換用）
func Enqueue(projectID string, workspaceID string) (*model.Queue, error) {
	preview, err := PreviewRender(projectID, workspaceID)
	if err != nil {
		return nil, err
	}
	return EnqueueWithPreview(projectID, workspaceID, preview)
}

func resolveBlenderPath(workspaceBlenderID, projectBlenderID uint) (string, error) {
	id := workspaceBlenderID
	if id == 0 {
		id = projectBlenderID
	}
	if id != 0 {
		b, err := model.GetBlenderInstall(id)
		if err != nil {
			return "", err
		}
		return b.Path, nil
	}
	b, err := model.FirstBlender()
	if err != nil {
		return "", xerrors.New("Blenderが登録されていません")
	}
	return b.Path, nil
}

func resolveBlenderFile(projectFileID string, projectID string) (string, error) {
	if projectFileID != "" {
		f, err := model.GetProjectFile(projectFileID)
		if err != nil || f == nil {
			return "", xerrors.Errorf("Blenderファイルが見つかりません: id=%d", projectFileID)
		}
		return f.Path, nil
	}
	f, err := model.FirstFile(projectID)
	if err != nil || f == nil {
		return "", xerrors.New("プロジェクトにBlenderファイルがありません")
	}
	return f.Path, nil
}

func executeQueue(q *model.Queue, job *model.Job) {

	b, err := exec.NewBlender(job.BlenderPath)
	if err != nil {
		finishJob(q.ID, false, err.Error(), 0)
		return
	}

	b.File = job.BlenderFile
	b.Scene = job.Scene
	b.Engine = job.Engine
	b.Format = exec.ExtToFormat(job.OutputExt)
	b.Start = job.StartFrame
	b.End = job.EndFrame
	b.Skip = job.FrameStep
	b.Thread = job.Thread
	b.Result = filepath.Join(job.OutputDir, "frame_####")

	run := exec.NewRunScript()
	run.Samples.Scene = b.Scene

	if job.Samples > 0 {
		run.Samples.Set = true
		run.Samples.Value = job.Samples
		run.Samples.IsCycles, run.Samples.IsEevee, run.Samples.IsWorkbench = exec.EngineFlags(job.Engine)
	}

	if job.ResolutionX > 0 && job.ResolutionY > 0 {
		run.Resolution.Set = true
		run.Resolution.Scene = b.Scene
		run.Resolution.X = job.ResolutionX
		run.Resolution.Y = job.ResolutionY
	}

	if job.Camera != "" {
		run.Camera.Set = true
		run.Camera.Scene = job.Scene
		run.Camera.Name = job.Camera
	}

	if runScript, rsErr := exec.GetRunPythonFile(run); rsErr == nil {
		b.RunScript = runScript
	} else {
		log.Println("GetRunPythonFile error (rendering continues without script):", rsErr)
	}

	pw := exec.NewProcessingWriter(job.StartFrame, job.EndFrame)
	exec.RegisterProgress(q.ID, pw)
	defer exec.UnregisterProgress(q.ID)

	logPath := filepath.Join(job.OutputDir, "render.log")
	logFile, logErr := os.Create(logPath)
	if logErr == nil {
		b.Writer = io.MultiWriter(logFile, pw)
		b.ErrorWriter = io.MultiWriter(logFile, pw)
		defer logFile.Close()
	} else {
		b.Writer = pw
		b.ErrorWriter = pw
	}

	pid, errCh, err := b.RunWithPID(context.Background())
	if err != nil {
		finishJob(q.ID, false, err.Error(), 0)
		return
	}

	now := time.Now()
	if updateErr := model.UpdateQueueRunning(q.ID, pid); updateErr != nil {
		log.Println("UpdateQueueRunning error:", updateErr)
	}
	if updateErr := model.UpdateJobStarted(q.ID, &now); updateErr != nil {
		log.Println("UpdateJobStarted error:", updateErr)
	}

	blenderErr := <-errCh
	diskSize := calcDirSize(job.OutputDir)
	if blenderErr != nil {
		finishJob(q.ID, false, blenderErr.Error(), diskSize)
	} else {
		finishJob(q.ID, true, "", diskSize)
	}
}

// calcDirSize はディレクトリ以下の画像・動画ファイルのサイズ合計をバイトで返す。
func calcDirSize(dir string) int64 {
	imageExts := map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".exr": true,
		".tiff": true, ".tif": true, ".bmp": true, ".hdr": true,
		".webp": true, ".tga": true,
	}
	var total int64
	filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if !imageExts[ext] {
			return nil
		}
		info, err := d.Info()
		if err == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

// removeOutputDirs は出力フォルダ一覧を存在確認の上で削除する。
func removeOutputDirs(dirs []string) {
	for _, dir := range dirs {
		if dir == "" {
			continue
		}
		if _, err := os.Stat(dir); err == nil {
			if err := os.RemoveAll(dir); err != nil {
				log.Println("removeOutputDirs:", err)
			}
		}
	}
}

// finishJob updates the Job status, sets CompletedAt, then deletes the Queue record.
func finishJob(id string, success bool, errMsg string, diskSize int64) {
	now := time.Now()
	status := model.JobCompleted
	dataStatus := model.JobDataAvailable
	if !success {
		status = model.JobError
		dataStatus = model.JobDataCorrupted
	}
	if err := model.UpdateJobDone(id, status, errMsg, &now, diskSize, dataStatus); err != nil {
		log.Println("UpdateJobDone error:", err)
	}
	if err := model.DeleteQueue(id); err != nil {
		log.Println("DeleteQueue error:", err)
	}
	startNextWaiting()
	notifyQueueChanged()
}

// startNextWaiting は実行上限に空きがあれば待機中の最古ジョブを起動する。
// scheduleMu でレースを防ぎ、DB 更新後にロックを解放してから goroutine を起動する。
func startNextWaiting() {
	scheduleMu.Lock()
	running, _ := model.CountRunningQueues()
	if running >= getMaxConcurrentJobs() {
		scheduleMu.Unlock()
		return
	}
	q, err := model.GetOldestWaitingQueue()
	if err != nil || q == nil {
		scheduleMu.Unlock()
		return
	}
	j, err := model.GetJob(q.ID)
	if err != nil || j == nil {
		scheduleMu.Unlock()
		return
	}
	// 待機中にロックされた場合はジョブを起動しない
	if p, pErr := model.SelectProject(j.ProjectID); pErr == nil && p != nil {
		if wd, wErr := model.GetWorkDir(p.WorkDirID); wErr == nil && wd != nil && wd.Status == model.WorkDirStatusLock {
			scheduleMu.Unlock()
			return
		}
	}
	_ = model.MarkQueueStarting(q.ID)
	scheduleMu.Unlock()

	go executeQueue(q, j)
}

// QueueItem combines Queue (active state) with Job (parameters/names) for display.
type QueueItem struct {
	ID            string     `json:"id"`
	ProjectID     string     `json:"project_id"`
	ProjectName   string     `json:"project_name"`
	WorkspaceID   string     `json:"workspace_id"`
	WorkspaceName string     `json:"workspace_name"`
	Engine        string     `json:"engine"`
	StartFrame    int        `json:"start_frame"`
	EndFrame      int        `json:"end_frame"`
	Status        string     `json:"status"`
	ProcessID     int        `json:"process_id"`
	StartedAt     *time.Time `json:"started_at"`
	CreatedAt     *time.Time `json:"created_at"`
	// Progress (populated only while running)
	NowFrame     int        `json:"now_frame"`
	ExpectedAt   *time.Time `json:"expected_at,omitempty"`
	AverageSec   float64    `json:"average_sec"`
	Log1         string     `json:"log1,omitempty"`
	Log2         string     `json:"log2,omitempty"`
	NowTile      int        `json:"now_tile"`
	TotalTiles   int        `json:"total_tiles"`
	NowSample    int        `json:"now_sample"`
	TotalSamples int        `json:"total_samples"`
	FrameActive  bool       `json:"frame_active"`
}

func ListQueues() ([]*model.Queue, error) {
	return model.ListQueues()
}

func ListQueueItems() ([]*QueueItem, error) {
	queues, err := model.ListQueues()
	if err != nil {
		return nil, err
	}
	items := make([]*QueueItem, 0, len(queues))
	for _, q := range queues {
		item := &QueueItem{
			ID:          q.ID,
			ProjectID:   q.ProjectID,
			WorkspaceID: q.WorkspaceID,
			Status:      q.Status,
			ProcessID:   q.ProcessID,
			StartedAt:   q.StartedAt,
			CreatedAt:   q.CreatedAt,
		}
		if j, err := model.GetJob(q.ID); err == nil && j != nil {
			item.ProjectName = j.ProjectName
			item.WorkspaceName = j.WorkspaceName
			item.Engine = j.Engine
			item.StartFrame = j.StartFrame
			item.EndFrame = j.EndFrame
		}
		if pr := exec.GetProgress(q.ID); pr != nil {
			if pr.NowFrame > 0 {
				item.NowFrame = pr.NowFrame
			}
			if !pr.ExpectedTime.IsZero() {
				item.ExpectedAt = &pr.ExpectedTime
			}
			if pr.AverageTime > 0 {
				item.AverageSec = pr.AverageTime.Seconds()
			}
			item.Log1 = pr.Log1
			item.Log2 = pr.Log2
			item.NowTile = pr.NowTile
			item.TotalTiles = pr.TotalTiles
			item.NowSample = pr.NowSample
			item.TotalSamples = pr.TotalSamples
			item.FrameActive = pr.FrameActive
		}
		items = append(items, item)
	}
	return items, nil
}

func ListQueuesByWorkspace(projectID string, workspaceID string) ([]*model.Queue, error) {
	return model.ListQueuesByWorkspace(projectID, workspaceID)
}

func GetQueue(id string) (*model.Queue, error) {
	return model.GetQueue(id)
}

func CancelQueue(id string) error {
	q, err := model.GetQueue(id)
	if err != nil {
		return xerrors.Errorf("GetQueue: %w", err)
	}
	if q.Status != model.QueueRunning && q.Status != model.QueueWaiting {
		return xerrors.New("実行中または待機中のジョブではありません")
	}
	if q.ProcessID > 0 {
		proc, err := os.FindProcess(q.ProcessID)
		if err == nil {
			proc.Kill()
		}
	}
	now := time.Now()
	j, _ := model.GetJob(q.ID)
	var diskSize int64
	if j != nil {
		diskSize = calcDirSize(j.OutputDir)
	}
	if err := model.UpdateJobDone(q.ID, model.JobCancelled, "", &now, diskSize, model.JobDataCorrupted); err != nil {
		log.Println("UpdateJobDone(cancelled) error:", err)
	}
	wasRunning := q.Status == model.QueueRunning
	if err := model.DeleteQueue(q.ID); err != nil {
		return err
	}
	if wasRunning {
		startNextWaiting()
	}
	notifyQueueChanged()
	return nil
}

func ListJobs() ([]*model.Job, error) {
	return model.ListJobs()
}

func UpdateJobMeta(id, name, note string) error {
	return model.UpdateJobMeta(id, name, note)
}

func DeleteJob(id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJob GetJob: %w", err)
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブは削除できません")
	}
	if j.OutputDir != "" {
		if _, statErr := os.Stat(j.OutputDir); statErr == nil {
			if rmErr := os.RemoveAll(j.OutputDir); rmErr != nil {
				log.Println("DeleteJob RemoveAll:", rmErr)
			}
		}
	}
	return model.DeleteJob(id)
}

// BulkDeleteJobsByWorkspace はワークスペースのジョブ履歴を一括削除する。
// errorOnly=true のとき: ロックされていないエラージョブをすべて物理削除する（keepCount/dataOnly は無視）。
// errorOnly=false のとき: ロックされていないジョブのうち最新 keepCount 件を残し残りを削除する。
// dataOnly=true の場合は出力データのみ削除してジョブ履歴を残す（DataStatus を削除済みに更新）。
// ロック済みジョブは常に保持される。削除件数を返す。
func BulkDeleteJobsByWorkspace(projectID, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	jobs, err := model.ListJobsByWorkspace(projectID, workspaceID)
	if err != nil {
		return 0, xerrors.Errorf("BulkDeleteJobsByWorkspace: %w", err)
	}

	var toDelete []*model.Job
	if errorOnly {
		for _, j := range jobs {
			if j.DataStatus%2 == 0 && j.Status == model.JobError {
				toDelete = append(toDelete, j)
			}
		}
	} else {
		if keepCount < 0 {
			keepCount = 0
		}
		// jobs は enqueued_at DESC 順（最新が先頭）
		var nonLocked []*model.Job
		for _, j := range jobs {
			if j.DataStatus%2 == 0 {
				nonLocked = append(nonLocked, j)
			}
		}
		if keepCount < len(nonLocked) {
			toDelete = nonLocked[keepCount:]
		}
	}

	deleted := 0
	for _, j := range toDelete {
		var opErr error
		if dataOnly {
			opErr = DeleteJobData(j.ID)
		} else {
			opErr = DeleteJob(j.ID)
		}
		if opErr != nil {
			log.Println("BulkDeleteJobsByWorkspace:", opErr)
			continue
		}
		deleted++
	}
	return deleted, nil
}

func DeleteJobData(id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobData GetJob: %w", err)
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブのデータは削除できません")
	}
	if j.OutputDir != "" {
		if _, statErr := os.Stat(j.OutputDir); statErr == nil {
			if rmErr := os.RemoveAll(j.OutputDir); rmErr != nil {
				return xerrors.Errorf("DeleteJobData RemoveAll: %w", rmErr)
			}
		}
	}
	return model.UpdateJobDataStatus(id, model.JobDataDeleted)
}

func LockJob(id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("LockJob GetJob: %w", err)
	}
	if j.DataStatus%2 == 1 {
		return nil // すでにロック済み
	}
	return model.UpdateJobDataStatus(id, j.DataStatus+1)
}

func UnlockJob(id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("UnlockJob GetJob: %w", err)
	}
	if j.DataStatus%2 == 0 {
		return nil // ロックされていない
	}
	return model.UpdateJobDataStatus(id, j.DataStatus-1)
}

// ListJobImages はジョブの出力ディレクトリにある画像ファイルのパス一覧を昇順で返す。
func ListJobImages(id string) ([]string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, xerrors.Errorf("ListJobImages GetJob: %w", err)
	}
	if j.OutputDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(j.OutputDir)
	if err != nil {
		return nil, xerrors.Errorf("ListJobImages ReadDir: %w", err)
	}
	var paths []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".png" || ext == ".jpg" || ext == ".jpeg" {
			paths = append(paths, filepath.Join(j.OutputDir, e.Name()))
		}
	}
	return paths, nil
}

// JobFileInfo はジョブ出力ディレクトリのファイル情報。
type JobFileInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
	IsDir   bool      `json:"is_dir"`
}

// ListJobFiles はジョブの出力ディレクトリにある全ファイルの情報を返す。
func ListJobFiles(id string) ([]*JobFileInfo, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, xerrors.Errorf("ListJobFiles GetJob: %w", err)
	}
	if j.OutputDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(j.OutputDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, xerrors.Errorf("ListJobFiles ReadDir: %w", err)
	}
	list := make([]*JobFileInfo, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		list = append(list, &JobFileInfo{
			Name:    e.Name(),
			Path:    filepath.Join(j.OutputDir, e.Name()),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			IsDir:   e.IsDir(),
		})
	}
	return list, nil
}

// GetImageBase64 は指定パスの画像を base64 データ URI として返す。
func GetImageBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", xerrors.Errorf("GetImageBase64: %w", err)
	}
	mime := "image/png"
	switch strings.ToLower(filepath.Ext(path)) {
	case ".jpg", ".jpeg":
		mime = "image/jpeg"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func ListJobsByWorkspace(projectID string, workspaceID string) ([]*model.Job, error) {
	return model.ListJobsByWorkspace(projectID, workspaceID)
}

func ListJobsByProjectFile(projectID string, projectFileID string) ([]*model.Job, error) {
	return model.ListJobsByProjectFile(projectID, projectFileID)
}

// ZipJobData は job の OutputDir 全体を ZIP 圧縮して savePath に書き出す。
func ZipJobData(id string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobData GetJob: %w", err)
	}
	// none(0/1) または deleted(4/5) はデータなし。modified(8/9) は一部残存のため許可。
	if j.DataStatus == model.JobDataNone || j.DataStatus == model.JobDataNoneLocked ||
		j.DataStatus == model.JobDataDeleted || j.DataStatus == model.JobDataDeletedLocked {
		return xerrors.New("data is not available")
	}
	if j.OutputDir == "" {
		return xerrors.New("output directory is not set")
	}
	if _, err := os.Stat(j.OutputDir); os.IsNotExist(err) {
		return xerrors.New("output directory does not exist")
	}

	f, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("ZipJobData Create: %w", err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)
	defer zw.Close()

	return filepath.Walk(j.OutputDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, err := filepath.Rel(j.OutputDir, path)
		if err != nil {
			return err
		}
		w, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		defer src.Close()
		_, err = io.Copy(w, src)
		return err
	})
}

// GetJobLog は job の OutputDir にある render.log の内容を返す。
// ファイルが存在しない場合は空文字を返す。
func GetJobLog(id string) (string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return "", xerrors.Errorf("GetJobLog GetJob: %w", err)
	}
	if j.OutputDir == "" {
		return "", nil
	}
	logPath := filepath.Join(j.OutputDir, "render.log")
	data, err := os.ReadFile(logPath)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", xerrors.Errorf("GetJobLog ReadFile: %w", err)
	}
	return string(data), nil
}

// ZipJobSelectedFiles は job の OutputDir 内の指定ファイルのみを ZIP 圧縮して savePath に書き出す。
func ZipJobSelectedFiles(id string, filePaths []string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles GetJob: %w", err)
	}
	f, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles Create: %w", err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	for _, path := range filePaths {
		rel, relErr := filepath.Rel(j.OutputDir, path)
		if relErr != nil {
			rel = filepath.Base(path)
		}
		w, err := zw.Create(filepath.ToSlash(rel))
		if err != nil {
			return err
		}
		src, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(w, src)
		src.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// DeleteJobFiles は job の OutputDir 内の指定ファイルを削除する。
// ロック中のジョブは削除不可。OutputDir 外のパスは無視する。
// 削除後、ファイルが残っていれば JobDataModified、全削除なら JobDataDeleted にステータスを更新する。
func DeleteJobFiles(id string, filePaths []string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobFiles GetJob: %w", err)
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブのファイルは削除できません")
	}
	absOut, err := filepath.Abs(j.OutputDir)
	if err != nil {
		return xerrors.Errorf("DeleteJobFiles Abs: %w", err)
	}
	for _, p := range filePaths {
		absP, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		rel, err := filepath.Rel(absOut, absP)
		if err != nil || len(rel) >= 2 && rel[:2] == ".." {
			continue // OutputDir 外は無視
		}
		os.Remove(absP)
	}
	// 残存ファイルを確認してステータスを更新
	hasFiles := false
	_ = filepath.WalkDir(absOut, func(_ string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			hasFiles = true
		}
		return nil
	})
	newStatus := model.JobDataModified
	if !hasFiles {
		newStatus = model.JobDataDeleted
	}
	return model.UpdateJobDataStatus(id, newStatus)
}
