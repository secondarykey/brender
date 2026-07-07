package sysmon

import (
	"runtime"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

// Stats represents a snapshot of system resource usage.
type Stats struct {
	CPUUsage     float64    `json:"cpu_usage"`
	MemUsage     float64    `json:"mem_usage"`
	MemTotalMB   uint64     `json:"mem_total_mb"`
	MemUsedMB    uint64     `json:"mem_used_mb"`
	GPUAvailable bool       `json:"gpu_available"`
	GPUs         []GPUStats `json:"gpus"`
}

type GPUStats struct {
	Index       int     `json:"index"`
	Name        string  `json:"name"`
	Usage       float64 `json:"usage"`
	MemUsage    float64 `json:"mem_usage"`
	MemTotalMB  uint64  `json:"mem_total_mb"`
	MemUsedMB   uint64  `json:"mem_used_mb"`
	Temperature uint32  `json:"temperature"`
}

var (
	mu       sync.Mutex
	stopCh   chan struct{}
	running  bool
	latest   Stats
	callback func(Stats)
)

// SetCallback sets the function to be called with each stats update.
func SetCallback(fn func(Stats)) {
	mu.Lock()
	defer mu.Unlock()
	callback = fn
}

// Start begins periodic stats collection at the given interval.
func Start(interval time.Duration) {
	mu.Lock()
	defer mu.Unlock()
	if running {
		return
	}
	stopCh = make(chan struct{})
	running = true

	initGPU()

	go pollLoop(interval, stopCh)
}

// Stop halts the periodic stats collection.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	if !running {
		return
	}
	close(stopCh)
	running = false
	shutdownGPU()
}

// Latest returns the most recently collected stats.
func Latest() Stats {
	mu.Lock()
	defer mu.Unlock()
	return latest
}

func pollLoop(interval time.Duration, stop chan struct{}) {
	collect()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			collect()
		}
	}
}

func collect() {
	var s Stats

	if pcts, err := cpu.Percent(0, false); err == nil && len(pcts) > 0 {
		s.CPUUsage = pcts[0]
	}

	if v, err := mem.VirtualMemory(); err == nil {
		s.MemUsage = v.UsedPercent
		s.MemTotalMB = v.Total / (1024 * 1024)
		s.MemUsedMB = v.Used / (1024 * 1024)
	}

	s.GPUAvailable, s.GPUs = collectGPU()

	mu.Lock()
	latest = s
	fn := callback
	mu.Unlock()

	if fn != nil {
		fn(s)
	}

	runtime.Gosched()
}
