package api

import (
	"context"
	"time"

	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

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
	if q.Status == model.QueueRunning {
		// 実行 goroutine は kill されたプロセスの終了を見て finishJob を呼び、そのままだと error で
		// 上書きする。cancelled のまま閉じさせる目印を kill より先に置く（kill 直後に finishJob が走り得る）。
		// kill できなかったときも、ここで cancelled として記録してキューを消すので目印は残す。
		userKilledQueues.Store(q.ID, struct{}{})
	}
	killQueueProcess(q.ProcessID, expectedPath)
	var diskSize int64
	if j != nil {
		diskSize = dirSize(j.OutputDir)
	}
	if err := model.UpdateJobDone(ctx, q.ID, model.JobCancelled, "", &now, diskSize, model.JobDataCorrupted); err != nil {
		log.Errorf("UpdateJobDone(cancelled) error: %v", err)
	}
	if err := model.DeleteQueue(q.ID); err != nil {
		return err
	}
	schedule()
	notifyQueueChanged()
	return nil
}
