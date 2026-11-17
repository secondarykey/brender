package api

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/secondarykey/brender/code"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

// writableProjectBaseDir は、プロジェクトに出力してよいか（移動中でない・作業ディレクトリがロックされていない）を
// 確かめて、出力先の基底パスを返す。投入では enqueueMu を取ったあとに呼ぶ。
func writableProjectBaseDir(projectID string) (string, error) {
	if err := checkProjectNotMoving(projectID); err != nil {
		return "", err
	}
	baseDir, err := GetProjectBaseDir(projectID)
	if err != nil {
		return "", xerrors.Errorf("GetProjectBaseDir: %w", err)
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return "", xerrors.Errorf("project not found: %w", err)
	}
	wd, err := model.GetWorkDir(p.WorkDirID)
	if err != nil || wd == nil {
		return "", xerrors.New("作業ディレクトリが設定されていません")
	}
	if wd.Status == model.WorkDirStatusLock {
		return "", xerrors.New("作業ディレクトリがロックされています。移行後に実行してください")
	}
	return baseDir, nil
}

// enqueueMu は投入時の重複チェック（ExistsQueueByWorkspace）からキュー作成（CreateQueue）
// までをアトミックにし、ダブルクリック等での同一ワークスペース二重投入を防ぐ。
var enqueueMu sync.Mutex

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

	return enqueuePreview(ctx, projectID, workspaceID, preview)
}

// jobName はジョブ名の頭「ファイル名 ワークスペース名」を返す。
// ワークスペース名はファイルごとに同じ（登録時の「Default」など）になりやすいので、ファイル名を付けて見分ける。
// ファイルが引けなければワークスペース名だけにする。
func jobName(projectFileID, workspaceName string) string {
	if f, err := model.GetProjectFile(projectFileID); err == nil && f != nil && f.Name != "" {
		return f.Name + " " + workspaceName
	}
	return workspaceName
}

// ErrPreviewChanged は確認ダイアログで見せたあとにレンダリングの設定が変わったことを表す。
var ErrPreviewChanged = xerrors.New("確認のあとでレンダリングの設定が変わりました。もう一度確認してください")

// EnqueueWithPreview は確認ダイアログで見せた RenderPreview（PreviewRender の結果）でジョブを作る。
// confirmed は画面から戻ってくる値なので信用しない。サーバで解決し直し、確認した内容と違えば断る。
// Blender の実行ファイルや .blend のパスを差し替えて、サーバで任意のプログラムを動かされないため。
// 確認のあとでワークスペースが変わった場合も、確認していない内容では動かさない。
func EnqueueWithPreview(ctx context.Context, projectID, workspaceID string, confirmed *RenderPreview) (*model.Queue, error) {
	if confirmed == nil {
		return nil, xerrors.New("EnqueueWithPreview: preview is required")
	}
	fresh, err := PreviewRender(ctx, projectID, workspaceID)
	if err != nil {
		return nil, err
	}
	if !sameRenderSettings(confirmed, fresh) {
		return nil, ErrPreviewChanged
	}
	return enqueuePreview(ctx, projectID, workspaceID, fresh)
}

// sameRenderSettings はジョブに使う値（Job に入る値）が同じかを返す。
// 名前や前回の情報など、表示のためだけの値は比べない。
func sameRenderSettings(a, b *RenderPreview) bool {
	return a.ProjectFileID == b.ProjectFileID &&
		a.BlenderPath == b.BlenderPath &&
		a.BlenderFile == b.BlenderFile &&
		a.Scene == b.Scene &&
		a.Engine == b.Engine &&
		a.StartFrame == b.StartFrame &&
		a.EndFrame == b.EndFrame &&
		a.FrameStep == b.FrameStep &&
		a.Thread == b.Thread &&
		a.Samples == b.Samples &&
		a.ResolutionX == b.ResolutionX &&
		a.ResolutionY == b.ResolutionY &&
		a.Camera == b.Camera &&
		a.OutputFormat == b.OutputFormat &&
		a.FPS == b.FPS &&
		a.JobType == b.JobType
}

// enqueuePreview はサーバで解決した RenderPreview でジョブを作成・実行する。
// preview は PreviewRender・TestEnqueue が作ったものだけを渡す（画面から来た値を渡さない）。
func enqueuePreview(ctx context.Context, projectID, workspaceID string, preview *RenderPreview) (*model.Queue, error) {
	// runner 以上の権限が必要
	if err := requireFileRole(ctx, preview.ProjectFileID, rolesRunnerUp...); err != nil {
		return nil, err
	}

	// 重複チェックからキュー作成までを直列化し、二重投入を防ぐ
	enqueueMu.Lock()
	defer enqueueMu.Unlock()

	// 出力先は移動中でないことを確かめてから読む（読んだあとに移動が終わると旧パスに出力してしまう）
	baseDir, err := writableProjectBaseDir(projectID)
	if err != nil {
		return nil, err
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
		Name:          fmt.Sprintf("%s(%d-%d)", jobName(preview.ProjectFileID, preview.WorkspaceName), preview.StartFrame, preview.EndFrame),
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
		FPS:           preview.FPS,
		JobType:       preview.JobType,
		EnqueuedAt:    &now,
	}
	if err := model.CreateJob(ctx, job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
	}

	if preview.JobType == model.JobTypeRender {
		if err := model.UpdateWorkspaceProcessedAt(ctx, workspaceID, &now); err != nil {
			log.Errorf("UpdateWorkspaceProcessedAt: %v", err)
		}
		if err := model.UpdateProjectFileProcessedAt(ctx, preview.ProjectFileID, &now); err != nil {
			log.Errorf("UpdateProjectFileProcessedAt: %v", err)
		}
		if err := model.UpdateProjectProcessedAt(ctx, projectID, &now); err != nil {
			log.Errorf("UpdateProjectProcessedAt: %v", err)
		}
	}

	q := &model.Queue{
		ID:          id,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		Status:      model.QueueWaiting,
	}
	if err := model.CreateQueue(ctx, q); err != nil {
		return nil, xerrors.Errorf("CreateQueue: %w", err)
	}

	// 待ちに入れてから起動の判断を schedule に任せる（空きがあっても先に待っているジョブを追い越さない）
	schedule()
	notifyQueueChanged()

	return q, nil
}

// Enqueue は PreviewRender + 投入のショートカット（確認ダイアログなし）
func Enqueue(ctx context.Context, projectID string, workspaceID string) (*model.Queue, error) {
	preview, err := PreviewRender(ctx, projectID, workspaceID)
	if err != nil {
		return nil, err
	}
	return enqueuePreview(ctx, projectID, workspaceID, preview)
}

// SamplesComparisonEnqueue はサンプル比較ジョブをキューに投入する。
// frame が 0 以下の場合は中間フレームを自動選択する。
func SamplesComparisonEnqueue(ctx context.Context, projectID, workspaceID string, sampleCounts []int, frame int) (*model.Queue, error) {
	if len(sampleCounts) == 0 {
		return nil, xerrors.New("サンプル数リストが空です")
	}

	// runner 以上の権限が必要（PreviewRender が確かめる）
	preview, err := PreviewRender(ctx, projectID, workspaceID)
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

	// 重複チェックからキュー作成までを直列化し、二重投入を防ぐ
	enqueueMu.Lock()
	defer enqueueMu.Unlock()

	// 出力先は移動中でないことを確かめてから読む（読んだあとに移動が終わると旧パスに出力してしまう）
	baseDir, err := writableProjectBaseDir(projectID)
	if err != nil {
		return nil, err
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
		Name:          fmt.Sprintf("%s(Samples Comparison)", jobName(preview.ProjectFileID, preview.WorkspaceName)),
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
	if err := model.CreateJob(ctx, job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
	}

	q := &model.Queue{
		ID:          id,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		Status:      model.QueueWaiting,
	}
	if err := model.CreateQueue(ctx, q); err != nil {
		return nil, xerrors.Errorf("CreateQueue: %w", err)
	}

	// 待ちに入れてから起動の判断を schedule に任せる（空きがあっても先に待っているジョブを追い越さない）
	schedule()
	notifyQueueChanged()

	return q, nil
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
