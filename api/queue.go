package api

import (
	"context"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/ikascrew/brender/exec"
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)


func Enqueue(projectID string, workspaceID string) (*model.Queue, error) {
	w, err := model.SelectWorkspace(projectID, workspaceID)
	if err != nil || w == nil {
		return nil, xerrors.Errorf("workspace not found: %w", err)
	}
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return nil, xerrors.Errorf("project not found: %w", err)
	}

	env, err := model.GetEnv()
	if err != nil {
		return nil, xerrors.Errorf("GetEnv: %w", err)
	}
	if env == nil || env.ProjectRoot == "" {
		return nil, xerrors.New("作業ディレクトリが設定されていません（システム設定で設定してください）")
	}

	// Load the project file for blender/scene fallback
	var fileBlenderID uint
	var fileScene string
	if w.ProjectFileID != 0 {
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

	// Generate shared UUID v7 for both Job and Queue
	id, err := model.NewQueueID()
	if err != nil {
		return nil, xerrors.Errorf("NewQueueID: %w", err)
	}

	// Output dir: {projectRoot}/{projectID}/{workspaceID}/{id}/
	outputDir := filepath.Join(env.ProjectRoot, projectID, workspaceID, id)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, xerrors.Errorf("MkdirAll: %w", err)
	}

	now := time.Now()

	// Insert Job first (history record, persists forever)
	job := &model.Job{
		ID:            id,
		ProjectID:     projectID,
		ProjectName:   p.Name,
		WorkspaceID:   workspaceID,
		WorkspaceName: w.Name,
		ProjectFileID: w.ProjectFileID,
		BlenderPath:   blenderPath,
		BlenderFile:   blenderFile,
		OutputDir:     outputDir,
		Scene:         scene,
		Engine:        w.Engine,
		StartFrame:    w.StartFrame,
		EndFrame:      w.EndFrame,
		FrameStep:     w.FrameStep,
		Thread:        w.Thread,
		EnqueuedAt:    &now,
	}
	if err := model.CreateJob(job); err != nil {
		return nil, xerrors.Errorf("CreateJob: %w", err)
	}

	// Insert Queue (ephemeral active-execution record)
	q := &model.Queue{
		ID:          id,
		ProjectID:   projectID,
		WorkspaceID: workspaceID,
		Status:      model.QueueWaiting,
	}
	if err := model.CreateQueue(q); err != nil {
		return nil, xerrors.Errorf("CreateQueue: %w", err)
	}

	go executeQueue(q, job)

	return q, nil
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

func resolveBlenderFile(projectFileID uint, projectID string) (string, error) {
	if projectFileID != 0 {
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
		finishJob(q.ID, false, err.Error())
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
		finishJob(q.ID, false, err.Error())
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
	if blenderErr != nil {
		finishJob(q.ID, false, blenderErr.Error())
	} else {
		finishJob(q.ID, true, "")
	}
}

// finishJob updates the Job status, sets CompletedAt, then deletes the Queue record.
func finishJob(id string, success bool, errMsg string) {
	now := time.Now()
	status := model.JobCompleted
	if !success {
		status = model.JobError
	}
	if err := model.UpdateJobDone(id, status, errMsg, &now); err != nil {
		log.Println("UpdateJobDone error:", err)
	}
	if err := model.DeleteQueue(id); err != nil {
		log.Println("DeleteQueue error:", err)
	}
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
			item.ProjectName   = j.ProjectName
			item.WorkspaceName = j.WorkspaceName
			item.Engine        = j.Engine
			item.StartFrame    = j.StartFrame
			item.EndFrame      = j.EndFrame
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
			item.Log1         = pr.Log1
			item.Log2         = pr.Log2
			item.NowTile      = pr.NowTile
			item.TotalTiles   = pr.TotalTiles
			item.NowSample    = pr.NowSample
			item.TotalSamples = pr.TotalSamples
			item.FrameActive  = pr.FrameActive
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
	if err := model.UpdateJobDone(q.ID, model.JobCancelled, "", &now); err != nil {
		log.Println("UpdateJobDone(cancelled) error:", err)
	}
	return model.DeleteQueue(q.ID)
}

func ListJobs() ([]*model.Job, error) {
	return model.ListJobs()
}

func ListJobsByWorkspace(projectID string, workspaceID string) ([]*model.Job, error) {
	return model.ListJobsByWorkspace(projectID, workspaceID)
}

func ListJobsByProjectFile(projectID string, projectFileID uint) ([]*model.Job, error) {
	return model.ListJobsByProjectFile(projectID, projectFileID)
}
