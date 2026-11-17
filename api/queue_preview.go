package api

import (
	"context"
	"os"
	"time"

	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

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
	FPS           float64             `json:"fps"`           // シーンのフレームレート（fps / fps_base）。0 = 不明
	JobType       string              `json:"job_type"`
	Previous      *PreviousRenderInfo `json:"previous"`
	// FileNotModified は前回のレンダリング（Previous と同じ、最後に完了したジョブ）が動き始めてから
	// ファイルが更新されていないこと。キャンセル・エラーで終わった実行は前回に数えない。
	// 確認ダイアログを開いた時点のファイルの更新時刻で判定する（画面が持っている古い値を使わない）。
	FileNotModified bool `json:"file_not_modified"`
}

// resolveFPS は再生・動画に使う FPS を決める。ワークスペースの指定 → シーンの値。どちらも無ければ 0（不明）。
// Blender のレンダリングには渡さない（画像の出力は FPS で変わらないため）。
func resolveFPS(workspaceFPS, sceneFPS float64) float64 {
	if workspaceFPS > 0 {
		return workspaceFPS
	}
	if sceneFPS > 0 {
		return sceneFPS
	}
	return 0
}

// fileNotModifiedSince は since 以降に path のファイルが更新されていなければ true を返す。
// 前回が無い（since が nil）ときは false。ファイルが読めないときは
// 更新を確認できないので true（更新されていない側）に倒す。
func fileNotModifiedSince(path string, since *time.Time) bool {
	if since == nil {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return true
	}
	return !info.ModTime().After(*since)
}

// renderReadAt は前回のレンダリングが .blend を読んだ時刻を返す。
// Blender がファイルを読むのは動き始めたときなので StartedAt、無ければ EnqueuedAt。前回が無ければ nil。
func renderReadAt(j *model.Job) *time.Time {
	if j == nil {
		return nil
	}
	if j.StartedAt != nil {
		return j.StartedAt
	}
	return j.EnqueuedAt
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
// レンダリングの前の確認なので runner 以上だけ（Blender でファイルを解析する）。
func PreviewRender(ctx context.Context, projectID, workspaceID string) (*RenderPreview, error) {
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return nil, xerrors.Errorf("workspace not found: %w", err)
	}
	if err := requireFileRole(ctx, w.ProjectFileID, rolesRunnerUp...); err != nil {
		return nil, err
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
		FPS:           resolveFPS(w.FPS, st.FPS),
		JobType:       model.JobTypeRender,
	}

	if prev, err := model.GetLatestCompletedRenderJob(workspaceID); err == nil && prev != nil {
		preview.FileNotModified = fileNotModifiedSince(blenderFile, renderReadAt(prev))
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
