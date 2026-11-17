package api

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/secondarykey/brender/exec"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"golang.org/x/xerrors"
)

func executeSamplesComparison(q *model.Queue, job *model.Job) {
	ctx := jobContext(job)
	b, err := exec.NewBlender(job.BlenderPath)
	if err != nil {
		finishJob(ctx, q.ID, false, err.Error(), 0)
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
		finishJob(ctx, q.ID, false, err.Error(), 0)
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
		finishJob(ctx, q.ID, false, err.Error(), 0)
		return
	}

	now := time.Now()
	if updateErr := model.UpdateQueueRunning(ctx, q.ID, pid); updateErr != nil {
		log.Errorf("UpdateQueueRunning error: %v", updateErr)
	}
	if updateErr := model.UpdateJobStarted(ctx, q.ID, &now); updateErr != nil {
		log.Errorf("UpdateJobStarted error: %v", updateErr)
	}

	blenderErr := <-errCh
	diskSize := dirSize(job.OutputDir)
	if blenderErr != nil {
		finishJob(ctx, q.ID, false, blenderErr.Error(), diskSize)
	} else {
		finishJob(ctx, q.ID, true, "", diskSize)
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
	ctx := jobContext(job)

	b, err := exec.NewBlender(job.BlenderPath)
	if err != nil {
		finishJob(ctx, q.ID, false, err.Error(), 0)
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
		log.Warnf("GetRunPythonFile error (rendering continues without script): %v", rsErr)
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
		finishJob(ctx, q.ID, false, err.Error(), 0)
		return
	}

	now := time.Now()
	if updateErr := model.UpdateQueueRunning(ctx, q.ID, pid); updateErr != nil {
		log.Errorf("UpdateQueueRunning error: %v", updateErr)
	}
	if updateErr := model.UpdateJobStarted(ctx, q.ID, &now); updateErr != nil {
		log.Errorf("UpdateJobStarted error: %v", updateErr)
	}

	blenderErr := <-errCh
	diskSize := dirSize(job.OutputDir)
	if blenderErr != nil {
		finishJob(ctx, q.ID, false, blenderErr.Error(), diskSize)
	} else {
		finishJob(ctx, q.ID, true, "", diskSize)
	}
}

// finishJob updates the Job status, sets CompletedAt, then deletes the Queue record.
// ctx は jobContext（記録にはジョブを投入した人が残る）。
func finishJob(ctx context.Context, id string, success bool, errMsg string, diskSize int64) {
	if shuttingDown.Load() {
		log.Noticef("finishJob: skipped (shutting down) id=%s", id)
		return
	}
	now := time.Now()
	status := model.JobCompleted
	dataStatus := model.JobDataAvailable
	if _, killed := userKilledQueues.LoadAndDelete(id); killed {
		// 利用者の強制終了。CancelQueue と同じく cancelled・データ破損扱いで閉じる。
		success = false
		status = model.JobCancelled
		errMsg = ""
		dataStatus = model.JobDataCorrupted
	} else if !success {
		status = model.JobError
		dataStatus = model.JobDataCorrupted
	}
	if err := model.UpdateJobDone(ctx, id, status, errMsg, &now, diskSize, dataStatus); err != nil {
		log.Errorf("UpdateJobDone error: %v", err)
	}
	if err := model.DeleteQueue(id); err != nil {
		log.Errorf("DeleteQueue error: %v", err)
	}
	if success {
		applyAutoLock(ctx, id, diskSize)
	}
	schedule()
	notifyQueueChanged()
}

// applyAutoLock は完了ジョブに対して自動ロック設定を適用する。
func applyAutoLock(ctx context.Context, jobID string, diskSize int64) {
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
	if err := model.UpdateJobDataStatus(ctx, jobID, model.JobDataAvailableLocked); err != nil {
		log.Errorf("applyAutoLock lock error: %v", err)
		return
	}
	keep := ws.AutoLockKeep
	if keep < 1 {
		keep = 1
	}
	count, err := model.CountAutoLockedJobs(ws.ID)
	if err != nil {
		log.Errorf("applyAutoLock count error: %v", err)
		return
	}
	for count > int64(keep) {
		oldest, err := model.GetOldestAutoLockedJob(ws.ID)
		if err != nil || oldest == nil {
			break
		}
		if err := model.UpdateJobDataStatus(ctx, oldest.ID, model.JobDataAvailable); err != nil {
			log.Errorf("applyAutoLock unlock error: %v", err)
			break
		}
		count--
	}
}
