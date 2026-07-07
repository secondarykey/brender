package api

import (
	"archive/zip"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ikascrew/brender/code"
	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
	"github.com/shirou/gopsutil/v4/process"
	"golang.org/x/xerrors"
)

// killQueueProcess は pid のプロセスが Blender の場合のみ強制終了する。
// 保存済み PID が OS に再利用され別プロセスに割り当てられている可能性があるため、
// 実行ファイルを検証してから kill し、無関係なプロセスの誤殺を防ぐ。
// expectedPath はジョブに記録された Blender 実行ファイルパス（不明なら空文字）。
func killQueueProcess(pid int, expectedPath string) {
	if pid <= 0 {
		return
	}
	proc, err := process.NewProcess(int32(pid))
	if err != nil {
		return // プロセスが存在しない
	}
	if !isBlenderProcess(proc, expectedPath) {
		log.Notice("killQueueProcess: pid %d is not blender (reused PID?), skip kill", pid)
		return
	}
	if osProc, err := os.FindProcess(pid); err == nil {
		osProc.Kill()
	}
}

// isBlenderProcess は proc が Blender プロセスかを判定する。
// 実行ファイルパスが expectedPath と一致するか、実行ファイル名に "blender" を含めば真。
func isBlenderProcess(proc *process.Process, expectedPath string) bool {
	if exe, err := proc.Exe(); err == nil && exe != "" {
		if expectedPath != "" && strings.EqualFold(filepath.Clean(exe), filepath.Clean(expectedPath)) {
			return true
		}
		return strings.Contains(strings.ToLower(filepath.Base(exe)), "blender")
	}
	// Exe が取得できない場合はプロセス名で判定
	if name, err := proc.Name(); err == nil {
		return strings.Contains(strings.ToLower(name), "blender")
	}
	return false
}

func getMaxConcurrentJobs() int64 {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.MaxConcurrentJobs <= 0 {
		return 1
	}
	return int64(env.MaxConcurrentJobs)
}

// ClearScripts は起動時に生成済みの Python スクリプトを一掃する。
// サーバモードは常駐するため、無制限な蓄積を防ぐ目的で呼ぶ。
func ClearScripts() error {
	return exec.ClearScripts()
}

// RecoverStaleQueues は起動時に running 状態のまま残ったキューを検出し、
// 旧ジョブを interrupted で閉じて新しい Job+Queue を recovering で作成する。
func RecoverStaleQueues() {
	queues, err := model.ListRunningQueues()
	if err != nil {
		log.Error("RecoverStaleQueues: ListRunningQueues: %v", err)
		return
	}
	if len(queues) == 0 {
		return
	}
	var recovered int
	for _, q := range queues {
		oldJob, err := model.GetJob(q.ID)

		// 孤立プロセスが生きていれば kill（Blender であることを検証してから）
		expectedPath := ""
		if oldJob != nil {
			expectedPath = oldJob.BlenderPath
		}
		killQueueProcess(q.ProcessID, expectedPath)

		if err != nil || oldJob == nil {
			log.Notice("RecoverStaleQueues: job %s not found, deleting orphan queue", q.ID)
			model.DeleteQueue(q.ID)
			continue
		}

		now := time.Now()
		diskSize := calcDirSize(oldJob.OutputDir)
		if err := model.UpdateJobDone(q.ID, model.JobInterrupted, "", &now, diskSize, model.JobDataCorrupted); err != nil {
			log.Error("RecoverStaleQueues: UpdateJobDone: %v", err)
		}
		if err := model.DeleteQueue(q.ID); err != nil {
			log.Error("RecoverStaleQueues: DeleteQueue: %v", err)
			continue
		}

		newID, err := model.NewQueueID()
		if err != nil {
			log.Error("RecoverStaleQueues: NewQueueID: %v", err)
			continue
		}

		newOutputDir := filepath.Join(filepath.Dir(oldJob.OutputDir), newID)
		if err := os.MkdirAll(newOutputDir, 0755); err != nil {
			log.Error("RecoverStaleQueues: MkdirAll: %v", err)
			continue
		}

		newJob := &model.Job{
			ID:            newID,
			Name:          oldJob.Name,
			ProjectID:     oldJob.ProjectID,
			WorkspaceID:   oldJob.WorkspaceID,
			ProjectFileID: oldJob.ProjectFileID,
			BlenderPath:   oldJob.BlenderPath,
			BlenderFile:   oldJob.BlenderFile,
			OutputDir:     newOutputDir,
			Scene:         oldJob.Scene,
			Engine:        oldJob.Engine,
			StartFrame:    oldJob.StartFrame,
			EndFrame:      oldJob.EndFrame,
			FrameStep:     oldJob.FrameStep,
			Thread:        oldJob.Thread,
			Samples:       oldJob.Samples,
			ResolutionX:   oldJob.ResolutionX,
			ResolutionY:   oldJob.ResolutionY,
			Camera:        oldJob.Camera,
			OutputExt:     oldJob.OutputExt,
			BlenderFormat: oldJob.BlenderFormat,
			JobType:       oldJob.JobType,
			SamplesList:   oldJob.SamplesList,
			EnqueuedAt:    &now,
		}
		if err := model.CreateJob(newJob); err != nil {
			log.Error("RecoverStaleQueues: CreateJob: %v", err)
			continue
		}

		newQueue := &model.Queue{
			ID:          newID,
			ProjectID:   oldJob.ProjectID,
			WorkspaceID: oldJob.WorkspaceID,
			Status:      model.QueueRecovering,
		}
		if err := model.CreateQueue(newQueue); err != nil {
			log.Error("RecoverStaleQueues: CreateQueue: %v", err)
			continue
		}

		log.Notice("RecoverStaleQueues: job %s interrupted, new queue %s created", q.ID, newID)
		recovered++
	}
	if recovered > 0 {
		log.Notice("RecoverStaleQueues: %d queue(s) recovered", recovered)
	}
}

var shuttingDown atomic.Bool

// IsShuttingDown はアプリがシャットダウン中かどうかを返す。
func IsShuttingDown() bool {
	return shuttingDown.Load()
}

// KillRunningQueues は実行中キューの Blender プロセスを強制終了する。
// アプリ終了前に呼び出し、孤立プロセスを防ぐ。
func KillRunningQueues() {
	shuttingDown.Store(true)
	queues, err := model.ListRunningQueues()
	if err != nil {
		log.Error("KillRunningQueues: ListRunningQueues: %v", err)
		return
	}
	for _, q := range queues {
		expectedPath := ""
		if j, err := model.GetJob(q.ID); err == nil && j != nil {
			expectedPath = j.BlenderPath
		}
		killQueueProcess(q.ProcessID, expectedPath)
	}
}

// StartRecoveredQueues はリカバリされた waiting キューのスケジューリングを開始する。
// MaxConcurrentJobs の上限まで複数件を起動する。
// QueueChangedHook 設定後に呼ぶこと。
func StartRecoveredQueues() {
	max := getMaxConcurrentJobs()
	for i := int64(0); i < max; i++ {
		startNextWaiting()
	}
	notifyQueueChanged()
}

// scheduleMu はキューの起動判定と DB 更新をアトミックに行うためのミューテックス。
var scheduleMu sync.Mutex

// enqueueMu は投入時の重複チェック（ExistsQueueByWorkspace）からキュー作成（CreateQueue）
// までをアトミックにし、ダブルクリック等での同一ワークスペース二重投入を防ぐ。
var enqueueMu sync.Mutex

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
	ProjectName   string              `json:"project_name"`
	WorkspaceName string              `json:"workspace_name"`
	ProjectFileID string              `json:"project_file_id"`
	BlenderPath   string              `json:"blender_path"`
	BlenderFile   string              `json:"blender_file"`
	Scene         string              `json:"scene"`
	Engine        string              `json:"engine"`
	StartFrame    int                 `json:"start_frame"`
	EndFrame      int                 `json:"end_frame"`
	FrameStep     int                 `json:"frame_step"`
	Thread        int                 `json:"thread"`
	Samples       int                 `json:"samples"`
	ResolutionX   int                 `json:"resolution_x"`
	ResolutionY   int                 `json:"resolution_y"`
	Camera        string              `json:"camera"`
	OutputFormat  string              `json:"output_format"` // 解決済みフォーマット名（"PNG" / "JPEG"）
	JobType       string              `json:"job_type"`
	Previous      *PreviousRenderInfo `json:"previous"`
}

type PreviousRenderInfo struct {
	Scene        string `json:"scene"`
	Engine       string `json:"engine"`
	StartFrame   int    `json:"start_frame"`
	EndFrame     int    `json:"end_frame"`
	FrameStep    int    `json:"frame_step"`
	Samples      int    `json:"samples"`
	ResolutionX  int    `json:"resolution_x"`
	ResolutionY  int    `json:"resolution_y"`
	Camera       string `json:"camera"`
	OutputFormat string `json:"output_format"`
}

// fileOverrides はプロジェクトファイルの固定設定（固定フラグ + 値）を保持する。
// 固定フラグ付きファイル指定はワークスペース/テストの指定より優先される。
type fileOverrides struct {
	blenderID    uint
	blenderFixed bool
	scene        string
	sceneFixed   bool
	camera       string
	cameraFixed  bool
	engine       string
	engineFixed  bool
}

// loadFileOverrides はプロジェクトファイルの固定設定を取得する。
// projectFileID が空、または取得失敗時はゼロ値（固定なし）を返す。
func loadFileOverrides(projectFileID string) fileOverrides {
	if projectFileID == "" {
		return fileOverrides{}
	}
	pf, err := model.GetProjectFile(projectFileID)
	if err != nil || pf == nil {
		return fileOverrides{}
	}
	return fileOverrides{
		blenderID:    pf.BlenderInstallID,
		blenderFixed: pf.BlenderFixed,
		scene:        pf.Scene,
		sceneFixed:   pf.SceneFixed,
		camera:       pf.Camera,
		cameraFixed:  pf.CameraFixed,
		engine:       pf.Engine,
		engineFixed:  pf.EngineFixed,
	}
}

// blenderID: 固定フラグありファイル指定を優先し、なければ requested を使う。
func (fo fileOverrides) resolveBlenderID(requested uint) uint {
	if fo.blenderFixed && fo.blenderID != 0 {
		return fo.blenderID
	}
	return requested
}

// scene: 固定フラグありファイル指定 → requested → ファイル指定。
func (fo fileOverrides) resolveScene(requested string) string {
	if fo.sceneFixed && fo.scene != "" {
		return fo.scene
	}
	if requested != "" {
		return requested
	}
	return fo.scene
}

// engine: 固定フラグありファイル指定 → requested → ファイル指定 → シーンのデフォルト。
func (fo fileOverrides) resolveEngine(requested, sceneDefault string) string {
	if fo.engineFixed && fo.engine != "" {
		return fo.engine
	}
	if requested != "" {
		return requested
	}
	if fo.engine != "" {
		return fo.engine
	}
	return sceneDefault
}

// camera: 固定フラグありファイル指定 → requested → ファイル指定 → シーンのデフォルト。
func (fo fileOverrides) resolveCamera(requested, sceneDefault string) string {
	if fo.cameraFixed && fo.camera != "" {
		return fo.camera
	}
	if requested != "" {
		return requested
	}
	if fo.camera != "" {
		return fo.camera
	}
	return sceneDefault
}

// resolvedBase はファイル固定・要求値・シーン解析を突き合わせた確定パラメータ。
type resolvedBase struct {
	BlenderPath string
	BlenderFile string
	Scene       *exec.SceneTool // ツール解析結果（フレーム範囲・サンプル既定値など）
	Engine      string
	Camera      string
}

// resolveRenderBase は Blender パス/ファイル、シーン解析、エンジン、カメラを解決する。
// reqBlenderID/reqScene/reqEngine/reqCamera は呼び出し側（ワークスペース or テスト params）の要求値。
// PreviewRender と TestEnqueue の共通の解決ロジックを担う。
func resolveRenderBase(projectID, projectFileID string, reqBlenderID uint, reqScene, reqEngine, reqCamera string) (*resolvedBase, error) {
	fo := loadFileOverrides(projectFileID)

	blenderPath, err := resolveBlenderPath(fo.resolveBlenderID(reqBlenderID), fo.blenderID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderPath: %w", err)
	}
	blenderFile, err := resolveBlenderFile(projectFileID, projectID)
	if err != nil {
		return nil, xerrors.Errorf("resolveBlenderFile: %w", err)
	}

	st, err := exec.ResolveScene(blenderPath, blenderFile, fo.resolveScene(reqScene))
	if err != nil {
		return nil, xerrors.Errorf("レンダリング前検証エラー: %w", err)
	}

	return &resolvedBase{
		BlenderPath: blenderPath,
		BlenderFile: blenderFile,
		Scene:       st,
		Engine:      fo.resolveEngine(reqEngine, st.Engine),
		Camera:      fo.resolveCamera(reqCamera, st.Camera),
	}, nil
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

	base, err := resolveRenderBase(projectID, w.ProjectFileID, w.BlenderInstallID, w.Scene, w.Engine, w.Camera)
	if err != nil {
		return nil, err
	}
	blenderPath := base.BlenderPath
	blenderFile := base.BlenderFile
	st := base.Scene
	engine := base.Engine
	camera := base.Camera

	// フレーム範囲: 未指定 (0,-1) はツール結果を使用、明示指定はそのまま
	startFrame := w.StartFrame
	endFrame := w.EndFrame
	if startFrame == 0 && endFrame == -1 {
		startFrame = st.Start
		endFrame = st.End
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

	preview := &RenderPreview{
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
		JobType:       model.JobTypeRender,
	}

	if prev, err := model.GetLatestCompletedRenderJob(workspaceID); err == nil && prev != nil {
		preview.Previous = &PreviousRenderInfo{
			Scene:        prev.Scene,
			Engine:       prev.Engine,
			StartFrame:   prev.StartFrame,
			EndFrame:     prev.EndFrame,
			FrameStep:    prev.FrameStep,
			Samples:      prev.Samples,
			ResolutionX:  prev.ResolutionX,
			ResolutionY:  prev.ResolutionY,
			Camera:       prev.Camera,
			OutputFormat: prev.BlenderFormat,
		}
	}

	return preview, nil
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
func TestEnqueue(ctx context.Context, projectID, workspaceID string, params TestRenderParams) (*model.Queue, error) {
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return nil, xerrors.Errorf("workspace not found: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, w.ProjectFileID, rolesRunnerUp...); err != nil {
		return nil, err
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return nil, xerrors.Errorf("project not found: %w", err)
	}

	base, err := resolveRenderBase(projectID, w.ProjectFileID, params.BlenderInstallID, params.Scene, params.Engine, params.Camera)
	if err != nil {
		return nil, err
	}
	st := base.Scene

	// フレーム範囲: 未指定 (0,-1) はシーンのデフォルトを使用
	startFrame := params.StartFrame
	endFrame := params.EndFrame
	if startFrame == 0 && endFrame == -1 {
		startFrame = st.Start
		endFrame = st.End
	}

	// 中間フレーム1枚のみレンダリング
	testFrame := (startFrame + endFrame) / 2

	preview := &RenderPreview{
		ProjectName:   p.Name,
		WorkspaceName: w.Name + " (Test)",
		ProjectFileID: w.ProjectFileID,
		BlenderPath:   base.BlenderPath,
		BlenderFile:   base.BlenderFile,
		Scene:         st.Name,
		Engine:        base.Engine,
		StartFrame:    testFrame,
		EndFrame:      testFrame,
		FrameStep:     1,
		Thread:        params.Thread,
		Samples:       8,
		ResolutionX:   params.ResolutionX,
		ResolutionY:   params.ResolutionY,
		Camera:        base.Camera,
		JobType:       model.JobTypeTest,
	}

	return EnqueueWithPreview(ctx, projectID, workspaceID, preview)
}

// EnqueueWithPreview は解決済みの RenderPreview を使ってジョブを作成・実行する。
func EnqueueWithPreview(ctx context.Context, projectID, workspaceID string, preview *RenderPreview) (*model.Queue, error) {
	// runner 以上の権限が必要
	if preview != nil {
		if err := requireFileRole(ctx, preview.ProjectFileID, rolesRunnerUp...); err != nil {
			return nil, err
		}
	}

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

	// 重複チェックからキュー作成までを直列化し、二重投入を防ぐ
	enqueueMu.Lock()
	defer enqueueMu.Unlock()

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
		WorkspaceID:   workspaceID,
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
		OutputExt:     resolveOutputExt(preview.OutputFormat),
		BlenderFormat: resolveBlenderFormat(preview.OutputFormat),
		JobType:       preview.JobType,
		EnqueuedAt:    &now,
	}
	if err := model.CreateJob(job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
	}

	if preview.JobType == model.JobTypeRender {
		if err := model.UpdateWorkspaceProcessedAt(workspaceID, &now); err != nil {
			log.Error("UpdateWorkspaceProcessedAt: %v", err)
		}
		if err := model.UpdateProjectFileProcessedAt(preview.ProjectFileID, &now); err != nil {
			log.Error("UpdateProjectFileProcessedAt: %v", err)
		}
		if err := model.UpdateProjectProcessedAt(projectID, &now); err != nil {
			log.Error("UpdateProjectProcessedAt: %v", err)
		}
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
func Enqueue(ctx context.Context, projectID string, workspaceID string) (*model.Queue, error) {
	preview, err := PreviewRender(projectID, workspaceID)
	if err != nil {
		return nil, err
	}
	return EnqueueWithPreview(ctx, projectID, workspaceID, preview)
}

// SamplesComparisonEnqueue はサンプル比較ジョブをキューに投入する。
// frame が 0 以下の場合は中間フレームを自動選択する。
func SamplesComparisonEnqueue(ctx context.Context, projectID, workspaceID string, sampleCounts []int, frame int) (*model.Queue, error) {
	if len(sampleCounts) == 0 {
		return nil, xerrors.New("サンプル数リストが空です")
	}

	// runner 以上の権限が必要
	if !fullAccess(ctx) {
		w, wErr := model.SelectWorkspace(projectID, workspaceID)
		if wErr == nil && w != nil {
			if err := requireFileRole(ctx, w.ProjectFileID, rolesRunnerUp...); err != nil {
				return nil, err
			}
		}
	}

	preview, err := PreviewRender(projectID, workspaceID)
	if err != nil {
		return nil, err
	}

	if frame < preview.StartFrame {
		frame = preview.StartFrame
	} else if frame > preview.EndFrame {
		frame = preview.EndFrame
	}

	sampleStrs := make([]string, len(sampleCounts))
	for i, s := range sampleCounts {
		sampleStrs[i] = fmt.Sprintf("%d", s)
	}
	samplesList := strings.Join(sampleStrs, ",")

	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return nil, xerrors.Errorf("GetProjectBaseDir: %w", err)
	}

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

	// 重複チェックからキュー作成までを直列化し、二重投入を防ぐ
	enqueueMu.Lock()
	defer enqueueMu.Unlock()

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
		Name:          fmt.Sprintf("%s(Samples Comparison)", preview.WorkspaceName),
		ProjectID:     projectID,
		WorkspaceID:   workspaceID,
		ProjectFileID: preview.ProjectFileID,
		BlenderPath:   preview.BlenderPath,
		BlenderFile:   preview.BlenderFile,
		OutputDir:     outputDir,
		Scene:         preview.Scene,
		Engine:        preview.Engine,
		StartFrame:    frame,
		EndFrame:      frame,
		FrameStep:     1,
		Thread:        preview.Thread,
		ResolutionX:   preview.ResolutionX,
		ResolutionY:   preview.ResolutionY,
		Camera:        preview.Camera,
		OutputExt:     resolveOutputExt(preview.OutputFormat),
		BlenderFormat: resolveBlenderFormat(preview.OutputFormat),
		JobType:       model.JobTypeSamplesComparison,
		SamplesList:   samplesList,
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

	scheduleMu.Lock()
	running, _ := model.CountRunningQueues()
	shouldStart := running < getMaxConcurrentJobs()
	if shouldStart {
		_ = model.MarkQueueStarting(id)
	}
	scheduleMu.Unlock()

	if shouldStart {
		go executeSamplesComparison(q, job)
	}
	notifyQueueChanged()

	return q, nil
}

func executeSamplesComparison(q *model.Queue, job *model.Job) {
	b, err := exec.NewBlender(job.BlenderPath)
	if err != nil {
		finishJob(q.ID, false, err.Error(), 0)
		return
	}

	b.File = job.BlenderFile

	sampleList := exec.ParseSamplesList(job.SamplesList)

	isCycles, isEevee, isWorkbench := exec.EngineFlags(job.Engine)
	dto := &exec.SamplesComparisonRun{
		Scene:         job.Scene,
		Frame:         job.StartFrame,
		SamplesList:   job.SamplesList,
		IsCycles:      isCycles,
		IsEevee:       isEevee,
		IsWorkbench:   isWorkbench,
		OutputDir:     filepath.ToSlash(job.OutputDir),
		Camera:        job.Camera,
		HasResolution: job.ResolutionX > 0 && job.ResolutionY > 0,
		ResolutionX:   job.ResolutionX,
		ResolutionY:   job.ResolutionY,
		Engine:        job.Engine,
		Format:        job.BlenderFormat,
	}

	scriptPath, err := exec.GetSamplesComparisonPythonFile(dto)
	if err != nil {
		finishJob(q.ID, false, err.Error(), 0)
		return
	}
	b.Python = scriptPath

	pw := exec.NewSamplesComparisonWriter(sampleList)
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
		log.Error("UpdateQueueRunning error: %v", updateErr)
	}
	if updateErr := model.UpdateJobStarted(q.ID, &now); updateErr != nil {
		log.Error("UpdateJobStarted error: %v", updateErr)
	}

	blenderErr := <-errCh
	diskSize := calcDirSize(job.OutputDir)
	if blenderErr != nil {
		finishJob(q.ID, false, blenderErr.Error(), diskSize)
	} else {
		finishJob(q.ID, true, "", diskSize)
	}
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
	if job.BlenderFormat != "" {
		b.Format = job.BlenderFormat
	} else {
		b.Format = exec.ExtToFormat(job.OutputExt) // 既存ジョブ向けフォールバック
	}
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
		log.Warn("GetRunPythonFile error (rendering continues without script): %v", rsErr)
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
		log.Error("UpdateQueueRunning error: %v", updateErr)
	}
	if updateErr := model.UpdateJobStarted(q.ID, &now); updateErr != nil {
		log.Error("UpdateJobStarted error: %v", updateErr)
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
				log.Error("removeOutputDirs: %v", err)
			}
		}
	}
}

// finishJob updates the Job status, sets CompletedAt, then deletes the Queue record.
func finishJob(id string, success bool, errMsg string, diskSize int64) {
	if shuttingDown.Load() {
		log.Notice("finishJob: skipped (shutting down) id=%s", id)
		return
	}
	now := time.Now()
	status := model.JobCompleted
	dataStatus := model.JobDataAvailable
	if !success {
		status = model.JobError
		dataStatus = model.JobDataCorrupted
	}
	if err := model.UpdateJobDone(id, status, errMsg, &now, diskSize, dataStatus); err != nil {
		log.Error("UpdateJobDone error: %v", err)
	}
	if err := model.DeleteQueue(id); err != nil {
		log.Error("DeleteQueue error: %v", err)
	}
	if success {
		applyAutoLock(id, diskSize)
	}
	startNextWaiting()
	notifyQueueChanged()
}

// applyAutoLock は完了ジョブに対して自動ロック設定を適用する。
func applyAutoLock(jobID string, diskSize int64) {
	j, err := model.GetJob(jobID)
	if err != nil || j == nil {
		return
	}
	ws, err := model.SelectWorkspace(j.ProjectID, j.WorkspaceID)
	if err != nil || ws == nil {
		return
	}
	if !ws.AutoLock {
		return
	}
	if ws.AutoLockMinSize > 0 && diskSize < ws.AutoLockMinSize {
		return
	}
	if err := model.UpdateJobDataStatus(jobID, model.JobDataAvailableLocked); err != nil {
		log.Error("applyAutoLock lock error: %v", err)
		return
	}
	keep := ws.AutoLockKeep
	if keep < 1 {
		keep = 1
	}
	count, err := model.CountAutoLockedJobs(ws.ID)
	if err != nil {
		log.Error("applyAutoLock count error: %v", err)
		return
	}
	for count > int64(keep) {
		oldest, err := model.GetOldestAutoLockedJob(ws.ID)
		if err != nil || oldest == nil {
			break
		}
		if err := model.UpdateJobDataStatus(oldest.ID, model.JobDataAvailable); err != nil {
			log.Error("applyAutoLock unlock error: %v", err)
			break
		}
		count--
	}
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

	go dispatchQueue(q, j)
}

func dispatchQueue(q *model.Queue, j *model.Job) {
	if j.JobType == model.JobTypeSamplesComparison {
		executeSamplesComparison(q, j)
	} else {
		executeQueue(q, j)
	}
}

// QueueItem combines Queue (active state) with Job (parameters/names) for display.
type QueueItem struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	ProjectID     string     `json:"project_id"`
	ProjectFileID string     `json:"project_file_id"`
	WorkspaceID   string     `json:"workspace_id"`
	Engine        string     `json:"engine"`
	StartFrame    int        `json:"start_frame"`
	EndFrame      int        `json:"end_frame"`
	Status        string     `json:"status"`
	ProcessID     int        `json:"process_id"`
	StartedAt     *time.Time `json:"started_at"`
	CreatedAt     *time.Time `json:"created_at"`
	JobType       string     `json:"job_type"`
	CanCancel     bool       `json:"can_cancel"`
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

func ListQueueItems(ctx context.Context) ([]*QueueItem, error) {
	queues, err := model.ListQueues()
	if err != nil {
		return nil, err
	}
	userID := currentUser(ctx)
	isOwner := fullAccess(ctx)
	// ファイルIDごとのキャンセル権限キャッシュ（同一ファイルの複数キューで重複チェック回避）
	cancelCache := map[string]bool{}

	// キューに対応する Job をまとめて1クエリで取得（N+1 回避）
	jobIDs := make([]string, 0, len(queues))
	for _, q := range queues {
		jobIDs = append(jobIDs, q.ID)
	}
	jobs, err := model.GetJobsByIDs(jobIDs)
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
			CanCancel:   isOwner,
		}
		if j := jobs[q.ID]; j != nil {
			item.Name = j.Name
			item.Engine = j.Engine
			item.StartFrame = j.StartFrame
			item.EndFrame = j.EndFrame
			item.JobType = j.JobType
			item.ProjectFileID = j.ProjectFileID
			if j.JobType == model.JobTypeSamplesComparison && j.SamplesList != "" {
				item.EndFrame = len(exec.ParseSamplesList(j.SamplesList))
				item.StartFrame = 0
			}
			// runner 以上がキャンセル可能
			if !isOwner && j.ProjectFileID != "" {
				if cached, ok := cancelCache[j.ProjectFileID]; ok {
					item.CanCancel = cached
				} else {
					ok, err := model.HasFileRole(j.ProjectFileID, userID, []string{model.RoleOwner, model.RoleWorkspaceCreator, model.RoleEditor, model.RoleRunner})
					if err == nil {
						item.CanCancel = ok
					}
					cancelCache[j.ProjectFileID] = item.CanCancel
				}
			}
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
			if item.JobType == model.JobTypeSamplesComparison {
				item.StartFrame = pr.StartFrame
				item.EndFrame = pr.EndFrame
			}
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

func CancelQueue(ctx context.Context, id string) error {
	q, err := model.GetQueue(id)
	if err != nil {
		return xerrors.Errorf("GetQueue: %w", err)
	}
	// runner 以上の権限が必要
	if !fullAccess(ctx) {
		j, err := model.GetJob(id)
		if err != nil {
			return xerrors.Errorf("CancelQueue GetJob: %w", err)
		}
		if j != nil {
			if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
				return err
			}
		}
	}
	if q.Status != model.QueueRunning && q.Status != model.QueueWaiting && q.Status != model.QueueRecovering {
		return xerrors.New("実行中または待機中のジョブではありません")
	}
	now := time.Now()
	j, _ := model.GetJob(q.ID)
	expectedPath := ""
	if j != nil {
		expectedPath = j.BlenderPath
	}
	killQueueProcess(q.ProcessID, expectedPath)
	var diskSize int64
	if j != nil {
		diskSize = calcDirSize(j.OutputDir)
	}
	if err := model.UpdateJobDone(q.ID, model.JobCancelled, "", &now, diskSize, model.JobDataCorrupted); err != nil {
		log.Error("UpdateJobDone(cancelled) error: %v", err)
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

func ListJobsPaged(ctx context.Context, filter *model.JobFilter, page, pageSize int) (*model.JobListResult, error) {
	result, err := model.ListJobsPaged(filter, page, pageSize)
	if err != nil {
		return nil, err
	}
	if fullAccess(ctx) {
		for _, j := range result.Jobs {
			j.HasFileAccess = true
		}
	} else {
		userID := currentUser(ctx)
		cache := map[string]bool{}
		for _, j := range result.Jobs {
			if j.ProjectFileID == "" {
				j.HasFileAccess = true
				continue
			}
			if v, ok := cache[j.ProjectFileID]; ok {
				j.HasFileAccess = v
				continue
			}
			ok, err := model.HasFileAccess(j.ProjectFileID, userID)
			if err == nil {
				j.HasFileAccess = ok
			}
			cache[j.ProjectFileID] = j.HasFileAccess
		}
	}
	return result, nil
}

func UpdateJobMeta(ctx context.Context, id, name, note string) error {
	// runner 以上の権限が必要
	if !fullAccess(ctx) {
		j, err := model.GetJob(id)
		if err != nil {
			return xerrors.Errorf("UpdateJobMeta GetJob: %w", err)
		}
		if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
			return err
		}
	}
	return model.UpdateJobMeta(id, name, note)
}

func DeleteJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return xerrors.New("ロック中のジョブは削除できません")
	}
	if j.OutputDir != "" {
		if _, statErr := os.Stat(j.OutputDir); statErr == nil {
			if rmErr := os.RemoveAll(j.OutputDir); rmErr != nil {
				log.Error("DeleteJob RemoveAll: %v", rmErr)
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
func BulkDeleteJobsByWorkspace(ctx context.Context, projectID, workspaceID string, keepCount int, dataOnly bool, errorOnly bool) (int, error) {
	// runner 以上の権限が必要（ワークスペースのファイルで判定）
	if !fullAccess(ctx) {
		if w, wErr := model.SelectWorkspace(projectID, workspaceID); wErr == nil && w != nil {
			if err := requireFileRole(ctx, w.ProjectFileID, rolesRunnerUp...); err != nil {
				return 0, err
			}
		}
	}
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
			opErr = DeleteJobData(ctx, j.ID)
		} else {
			opErr = DeleteJob(ctx, j.ID)
		}
		if opErr != nil {
			log.Error("BulkDeleteJobsByWorkspace: %v", opErr)
			continue
		}
		deleted++
	}
	return deleted, nil
}

func DeleteJobData(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobData GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
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

func LockJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("LockJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 1 {
		return nil // すでにロック済み
	}
	return model.UpdateJobDataStatus(id, j.DataStatus+1)
}

func UnlockJob(ctx context.Context, id string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("UnlockJob GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
	}
	if j.DataStatus%2 == 0 {
		return nil // ロックされていない
	}
	return model.UpdateJobDataStatus(id, j.DataStatus-1)
}

// ListJobImages はジョブの出力ディレクトリにある画像ファイルのパス一覧を昇順で返す。
func ListJobImages(ctx context.Context, id string) ([]string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, xerrors.Errorf("ListJobImages GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
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
func ListJobFiles(ctx context.Context, id string) ([]*JobFileInfo, error) {
	j, err := model.GetJob(id)
	if err != nil {
		log.Error("[ListJobFiles] GetJob error: %v", err)
		return nil, xerrors.Errorf("ListJobFiles GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
	}
	log.Debug("[ListJobFiles] job=%s outputDir=%q dataStatus=%d", id, j.OutputDir, j.DataStatus)
	if j.OutputDir == "" {
		log.Debug("[ListJobFiles] outputDir is empty, returning nil")
		return nil, nil
	}
	entries, err := os.ReadDir(j.OutputDir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Debug("[ListJobFiles] dir not found: %s", j.OutputDir)
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
		log.Debug("[ListJobFiles] file: %s (isDir=%v, size=%d)", e.Name(), e.IsDir(), info.Size())
		list = append(list, &JobFileInfo{
			Name:    e.Name(),
			Path:    filepath.Join(j.OutputDir, e.Name()),
			Size:    info.Size(),
			ModTime: info.ModTime(),
			IsDir:   e.IsDir(),
		})
	}
	log.Debug("[ListJobFiles] returning %d files", len(list))
	return list, nil
}

// GetImageBase64 は指定パスの画像を base64 データ URI として返す。
// 任意ファイル読み取りを防ぐため、パスは登録済み作業ディレクトリ配下に限定する。
func GetImageBase64(ctx context.Context, path string) (string, error) {
	if err := validateWorkDirPath(path); err != nil {
		return "", err
	}
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

func GetJob(ctx context.Context, id string) (*model.Job, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return nil, err
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return nil, err
	}
	return j, nil
}

// workspaceFileAccess はワークスペースのファイルに対する参照権限を確認する。
func workspaceFileAccess(ctx context.Context, projectID, workspaceID string) error {
	if fullAccess(ctx) {
		return nil
	}
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return xerrors.Errorf("workspace not found: %w", err)
	}
	return requireFileAccess(ctx, w.ProjectFileID)
}

func ListJobsByWorkspace(ctx context.Context, projectID string, workspaceID string) ([]*model.Job, error) {
	if err := workspaceFileAccess(ctx, projectID, workspaceID); err != nil {
		return nil, err
	}
	return model.ListJobsByWorkspace(projectID, workspaceID)
}

func ListJobsByWorkspacePaged(ctx context.Context, projectID, workspaceID string, page, pageSize int) (*model.JobPagedResult, error) {
	if err := workspaceFileAccess(ctx, projectID, workspaceID); err != nil {
		return nil, err
	}
	return model.ListJobsByWorkspacePaged(projectID, workspaceID, page, pageSize)
}

func ListJobsByProjectFile(ctx context.Context, projectID string, projectFileID string) ([]*model.Job, error) {
	if err := requireFileAccess(ctx, projectFileID); err != nil {
		return nil, err
	}
	return model.ListJobsByProjectFile(projectID, projectFileID)
}

func ListJobsByProjectFilePaged(ctx context.Context, projectID, projectFileID string, page, pageSize int) (*model.JobPagedResult, error) {
	if err := requireFileAccess(ctx, projectFileID); err != nil {
		return nil, err
	}
	return model.ListJobsByProjectFilePaged(projectID, projectFileID, page, pageSize)
}

// ZipJobData は job の OutputDir 全体を ZIP 圧縮して savePath に書き出す。
func ZipJobData(ctx context.Context, id string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobData GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return err
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
func GetJobLog(ctx context.Context, id string) (string, error) {
	j, err := model.GetJob(id)
	if err != nil {
		return "", xerrors.Errorf("GetJobLog GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return "", err
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
// OutputDir 外を指すパスは無視する（任意ファイルの吸い出しを防ぐ）。
func ZipJobSelectedFiles(ctx context.Context, id string, filePaths []string, savePath string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles GetJob: %w", err)
	}
	if err := requireFileAccess(ctx, j.ProjectFileID); err != nil {
		return err
	}
	absOut, err := filepath.Abs(j.OutputDir)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles Abs: %w", err)
	}
	f, err := os.Create(savePath)
	if err != nil {
		return xerrors.Errorf("ZipJobSelectedFiles Create: %w", err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	for _, path := range filePaths {
		absP, absErr := filepath.Abs(path)
		if absErr != nil {
			continue
		}
		rel, relErr := filepath.Rel(absOut, absP)
		if relErr != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue // OutputDir 外は無視
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
func DeleteJobFiles(ctx context.Context, id string, filePaths []string) error {
	j, err := model.GetJob(id)
	if err != nil {
		return xerrors.Errorf("DeleteJobFiles GetJob: %w", err)
	}
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, j.ProjectFileID, rolesRunnerUp...); err != nil {
		return err
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

// resolveImageFormat は出力フォーマット code から ImageFormat を引く。
// 見つからない場合は PNG のデフォルト値を返す。
func resolveImageFormat(formatCode string) code.ImageFormat {
	formats, err := code.GetImageFormats()
	if err == nil {
		for _, f := range formats {
			if f.Code == formatCode {
				return f
			}
		}
	}
	return code.ImageFormat{Code: "PNG", Label: "PNG", Ext: "png", BlenderValue: "PNG"}
}

func resolveOutputExt(formatCode string) string {
	return resolveImageFormat(formatCode).Ext
}

func resolveBlenderFormat(formatCode string) string {
	return resolveImageFormat(formatCode).BlenderValue
}

// GetCleanableJobStats はフィルタ条件に合致するクリーンアップ対象のジョブ統計を返す。
func GetCleanableJobStats(filter *model.CleanFilter) (*model.CleanableJobStats, error) {
	return model.GetCleanableJobStats(filter)
}

// CleanJobData はフィルタ条件に合致するジョブの出力データを削除する（履歴は残す）。
// プロジェクト横断のクリーンアップのため admin 権限を要求する。削除件数を返す。
func CleanJobData(ctx context.Context, filter *model.CleanFilter) (int, error) {
	if err := requireAdmin(ctx); err != nil {
		return 0, err
	}
	jobs, err := model.ListCleanableJobs(filter)
	if err != nil {
		return 0, xerrors.Errorf("CleanJobData: %w", err)
	}
	deleted := 0
	for _, j := range jobs {
		if err := DeleteJobData(ctx, j.ID); err != nil {
			log.Error("CleanJobData: %v", err)
			continue
		}
		deleted++
	}
	return deleted, nil
}

// MeasureFilteredDiskSize はフィルタ条件に合致するジョブの OutputDir を実測して合計バイト数を返す。
func MeasureFilteredDiskSize(filter *model.CleanFilter) (int64, error) {
	jobs, err := model.ListCleanableJobs(filter)
	if err != nil {
		return 0, xerrors.Errorf("MeasureFilteredDiskSize: %w", err)
	}
	var total int64
	for _, j := range jobs {
		if j.OutputDir == "" {
			continue
		}
		total += measureDirSize(j.OutputDir)
	}
	return total, nil
}

func measureDirSize(dir string) int64 {
	var total int64
	filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, e := d.Info(); e == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}
