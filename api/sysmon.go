package api

import (
	"time"

	"github.com/secondarykey/brender/sysmon"
)

// SystemStatsHook is called on each stats update while monitoring is active.
var SystemStatsHook func(stats sysmon.Stats)

// システムモニタは見ている人がいるあいだだけ動かす。
// 画面は systemMonitorTTL より短い間隔で KeepSystemMonitor を呼び続け、
// 誰も呼ばなくなると TTL 後に収集が止まる（nvidia-smi の起動もなくなる）。
const (
	systemMonitorInterval = 5 * time.Second
	systemMonitorTTL      = 15 * time.Second
)

// KeepSystemMonitor は収集を動かし（動いていれば期限を延ばし）、
// すでに動いていたときは直近の値を返す。動かし始めたときは nil
// （最初の値はすぐ SystemStatsHook で届く）。
func KeepSystemMonitor() *sysmon.Stats {
	sysmon.SetCallback(func(s sysmon.Stats) {
		if SystemStatsHook != nil {
			SystemStatsHook(s)
		}
	})
	return sysmon.Keep(systemMonitorInterval, systemMonitorTTL)
}

// StopSystemMonitor stops the periodic collection.
func StopSystemMonitor() {
	sysmon.Stop()
}

// GetSystemStats returns the latest snapshot.
func GetSystemStats() sysmon.Stats {
	return sysmon.Latest()
}
