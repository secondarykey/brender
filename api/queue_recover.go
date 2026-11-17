package api

import (
	"os"
	"path/filepath"
	"time"

	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
)

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
		log.Errorf("RecoverStaleQueues: ListRunningQueues: %v", err)
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
			log.Noticef("RecoverStaleQueues: job %s not found, deleting orphan queue", q.ID)
			model.DeleteQueue(q.ID)
			continue
		}

		// 記録には、もとのジョブを投入した人を残す（作り直すジョブもその人のもの）
		ctx := jobContext(oldJob)
		now := time.Now()
		diskSize := dirSize(oldJob.OutputDir)
		if err := model.UpdateJobDone(ctx, q.ID, model.JobInterrupted, "", &now, diskSize, model.JobDataCorrupted); err != nil {
			log.Errorf("RecoverStaleQueues: UpdateJobDone: %v", err)
		}
		if err := model.DeleteQueue(q.ID); err != nil {
			log.Errorf("RecoverStaleQueues: DeleteQueue: %v", err)
			continue
		}

		newID, err := model.NewQueueID()
		if err != nil {
			log.Errorf("RecoverStaleQueues: NewQueueID: %v", err)
			continue
		}

		newOutputDir := filepath.Join(filepath.Dir(oldJob.OutputDir), newID)
		if err := os.MkdirAll(newOutputDir, 0755); err != nil {
			log.Errorf("RecoverStaleQueues: MkdirAll: %v", err)
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
			FPS:           oldJob.FPS,
			JobType:       oldJob.JobType,
			SamplesList:   oldJob.SamplesList,
			EnqueuedAt:    &now,
		}
		if err := model.CreateJob(ctx, newJob); err != nil {
			log.Errorf("RecoverStaleQueues: CreateJob: %v", err)
			continue
		}

		newQueue := &model.Queue{
			ID:          newID,
			ProjectID:   oldJob.ProjectID,
			WorkspaceID: oldJob.WorkspaceID,
			Status:      model.QueueRecovering,
		}
		if err := model.CreateQueue(ctx, newQueue); err != nil {
			log.Errorf("RecoverStaleQueues: CreateQueue: %v", err)
			continue
		}

		log.Noticef("RecoverStaleQueues: job %s interrupted, new queue %s created", q.ID, newID)
		recovered++
	}
	if recovered > 0 {
		log.Noticef("RecoverStaleQueues: %d queue(s) recovered", recovered)
	}
}

// StartRecoveredQueues は起動時に、リカバリしたキューと前回から残っていた待ちのキューを起動する。
// QueueChangedHook 設定後に呼ぶこと。
func StartRecoveredQueues() {
	schedule()
	notifyQueueChanged()
}
