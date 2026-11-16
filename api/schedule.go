package api

import (
	"sync"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
)

func getMaxConcurrentJobs() int64 {
	env, err := model.GetEnv()
	if err != nil || env == nil || env.MaxConcurrentJobs <= 0 {
		return 1
	}
	return int64(env.MaxConcurrentJobs)
}

// scheduleMu はキューの起動判定と DB 更新をアトミックに行うためのミューテックス（schedule が使う）。
var scheduleMu sync.Mutex

// schedule は実行上限の空きの数だけ、待ちのキューを古い順（キュー ID = UUID v7 の順）に起動する。
// キューを起動する入口はここだけにする。空きが変わるとき・起動できるジョブが増えるときに呼ぶ:
// 投入・ジョブの終了・キャンセル・同時実行数の変更・作業ディレクトリの更新（lock の解除）・起動時のリカバリ。
// lock 中の作業ディレクトリのジョブは飛ばして後ろを起動する（先頭で全部を止めない）。
// scheduleMu の中で DB を running にしてから、ロックを放して実行の goroutine を起動する。
func schedule() {
	if shuttingDown.Load() {
		return
	}
	type start struct {
		q *model.Queue
		j *model.Job
	}
	var starts []start

	scheduleMu.Lock()
	running, err := model.CountRunningQueues()
	if err != nil {
		scheduleMu.Unlock()
		log.Errorf("schedule: CountRunningQueues: %v", err)
		return
	}
	free := getMaxConcurrentJobs() - running
	if free > 0 {
		waiting, err := model.ListWaitingQueues()
		if err != nil {
			log.Errorf("schedule: ListWaitingQueues: %v", err)
		}
		locked := map[string]bool{} // プロジェクトごとの、作業ディレクトリが lock 中か
		for _, q := range waiting {
			if free <= 0 {
				break
			}
			j, err := model.GetJob(q.ID)
			if err != nil || j == nil {
				log.Errorf("schedule: job of queue %s not found: %v", q.ID, err)
				continue
			}
			isLocked, seen := locked[j.ProjectID]
			if !seen {
				isLocked = workDirLocked(j.ProjectID)
				locked[j.ProjectID] = isLocked
			}
			if isLocked {
				continue
			}
			if err := model.MarkQueueStarting(q.ID); err != nil {
				log.Errorf("schedule: MarkQueueStarting %s: %v", q.ID, err)
				continue
			}
			starts = append(starts, start{q, j})
			free--
		}
	}
	scheduleMu.Unlock()

	for _, s := range starts {
		go runQueue(s.q, s.j)
	}
}

// workDirLocked はプロジェクトの作業ディレクトリが lock 中かを返す。
func workDirLocked(projectID string) bool {
	p, err := model.SelectProject(projectID)
	if err != nil || p == nil {
		return false
	}
	wd, err := model.GetWorkDir(p.WorkDirID)
	return err == nil && wd != nil && wd.Status == model.WorkDirStatusLock
}

// runQueue はキューを実行する。テストでは差し替えて Blender を起動しない。
// （宣言で dispatchQueue を入れると、dispatchQueue → finishJob → schedule → runQueue で初期化が循環する）
var runQueue func(q *model.Queue, j *model.Job)

func init() { runQueue = dispatchQueue }

func dispatchQueue(q *model.Queue, j *model.Job) {
	if j.JobType == model.JobTypeSamplesComparison {
		executeSamplesComparison(q, j)
	} else {
		executeQueue(q, j)
	}
}
