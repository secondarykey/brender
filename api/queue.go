package api

import (
	"context"
	"encoding/base64"
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

const maxConcurrentJobs = 2

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
	var fileScene string
	if w.ProjectFileID != "" {
		pf, pfErr := model.GetProjectFile(w.ProjectFileID)
		if pfErr == nil && pf != nil {
			fileBlenderID = pf.BlenderInstallID
			fileScene = pf.Scene
		}
	}

	blenderPath, err := resolveBlenderPath(w.BlenderInstallID, fileBlenderID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderPath: %w", err)
	}
	blenderFile, err := resolveBlenderFile(w.ProjectFileID, projectID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderFile: %w", err)
	}

	scene := w.Scene
	if scene == "" {
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

	// エンジン: ワークスペース指定 → シーンのデフォルト（ツール取得）の順でフォールバック
	engine := w.Engine
	if engine == "" {
		engine = st.Engine
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
	}, nil
}

// EnqueueWithPreview は解決済みの RenderPreview を使ってジョブを作成・実行する。
func EnqueueWithPreview(projectID, workspaceID string, preview *RenderPreview) (*model.Queue, error) {
	env, err := model.GetEnv()
	if err != nil {
		return nil, xerrors.Errorf("GetEnv: %w", err)
	}
	if env == nil || env.ProjectRoot == "" {
		return nil, xerrors.New("作業ディレクトリが設定されていません（システム設定で設定してください）")
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

	outputDir := filepath.Join(env.ProjectRoot, projectID, preview.ProjectFileID, workspaceID, id)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, xerrors.Errorf("MkdirAll: %w", err)
	}

	now := time.Now()

	job := &model.Job{
		ID:            id,
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
		EnqueuedAt:    &now,
	}
	if err := model.CreateJob(job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
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
	shouldStart := running < maxConcurrentJobs
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
	b.Start = job.StartFrame
	b.End = job.EndFrame
	b.Skip = job.FrameStep
	b.Thread = job.Thread
	b.Result = filepath.Join(job.OutputDir, "frame_####")

	run := exec.NewRunScript()
	run.Samples.Scene = b.Scene

	//TODO 強制的にサンプルを8 にするテスト
	//run.Samples.Set = true
	//run.Samples.IsCycles = true
	//run.Samples.Value = 8

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

// calcDirSize はディレクトリ以下の全ファイルサイズ合計をバイトで返す。
func calcDirSize(dir string) int64 {
	var total int64
	filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
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
		dataStatus = model.JobDataNone
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
	if running >= maxConcurrentJobs {
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
	if err := model.UpdateJobDone(q.ID, model.JobCancelled, "", &now, diskSize, model.JobDataNone); err != nil {
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
