package api

import (
	"time"

	"github.com/secondarykey/brender/sysmon"
)

// SystemStatsHook is called on each stats update while monitoring is active.
var SystemStatsHook func(stats sysmon.Stats)

// StartSystemMonitor begins periodic system stats collection.
func StartSystemMonitor() {
	sysmon.SetCallback(func(s sysmon.Stats) {
		if SystemStatsHook != nil {
			SystemStatsHook(s)
		}
	})
	sysmon.Start(2 * time.Second)
}

// StopSystemMonitor stops the periodic collection.
func StopSystemMonitor() {
	sysmon.Stop()
}

// GetSystemStats returns the latest snapshot.
func GetSystemStats() sysmon.Stats {
	return sysmon.Latest()
}
