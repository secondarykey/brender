package api

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
	"github.com/shirou/gopsutil/v4/process"
)

// killQueueProcess は pid のプロセスが Blender の場合のみ強制終了する。
// 保存済み PID が OS に再利用され別プロセスに割り当てられている可能性があるため、
// 実行ファイルを検証してから kill し、無関係なプロセスの誤殺を防ぐ。
// expectedPath はジョブに記録された Blender 実行ファイルパス（不明なら空文字）。
// kill を実行した（シグナルを送れた）ときに true を返す。
func killQueueProcess(pid int, expectedPath string) bool {
	if pid <= 0 {
		return false
	}
	proc, err := process.NewProcess(int32(pid))
	if err != nil {
		return false // プロセスが存在しない
	}
	if !isBlenderProcess(proc, expectedPath) {
		log.Noticef("killQueueProcess: pid %d is not blender (reused PID?), skip kill", pid)
		return false
	}
	osProc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return osProc.Kill() == nil
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

var shuttingDown atomic.Bool

// IsShuttingDown はアプリがシャットダウン中かどうかを返す。
func IsShuttingDown() bool {
	return shuttingDown.Load()
}

// userKilledQueues は利用者が止めた実行中キューの ID の集合（強制終了 KillRunningQueuesByUser と
// キャンセル CancelQueue）。kill されたプロセスの後始末は実行 goroutine の finishJob が行うため、
// そこで error ではなく cancelled として閉じるための目印にする。
var userKilledQueues sync.Map

// KillRunningQueues はアプリ終了時に実行中キューの Blender プロセスを強制終了する。
// shuttingDown を立てて以後の finishJob をスキップさせ、Queue レコードを running のまま残す
// （次回起動時に RecoverStaleQueues がリカバリする）。終了処理専用で、利用者の操作からは呼ばない。
func KillRunningQueues() {
	shuttingDown.Store(true)
	killRunningQueues(nil)
}

// KillRunningQueuesByUser は利用者の操作「実行中キューの強制終了」。admin 限定。
// shuttingDown は立てず、kill したジョブは finishJob が cancelled として閉じ、
// Queue レコードの削除と次の待機キューの起動も通常どおり行われる。
func KillRunningQueuesByUser(ctx context.Context) error {
	if err := requireAdmin(ctx); err != nil {
		return err
	}
	killRunningQueues(&userKilledQueues)
	return nil
}

// killRunningQueues は running のキューの Blender プロセスを kill する。
// marks が nil でなければ、kill したキュー ID を finishJob より先に記録する。
func killRunningQueues(marks *sync.Map) {
	queues, err := model.ListRunningQueues()
	if err != nil {
		log.Errorf("killRunningQueues: ListRunningQueues: %v", err)
		return
	}
	for _, q := range queues {
		expectedPath := ""
		if j, err := model.GetJob(q.ID); err == nil && j != nil {
			expectedPath = j.BlenderPath
		}
		if marks == nil {
			killQueueProcess(q.ProcessID, expectedPath)
			continue
		}
		// kill 直後に finishJob が走り得るため、目印は kill より先に置く。
		// kill しなかった（PID 未記録・別プロセス等）ならジョブは走り続けるので目印を外す。
		marks.Store(q.ID, struct{}{})
		if !killQueueProcess(q.ProcessID, expectedPath) {
			marks.Delete(q.ID)
		}
	}
}
