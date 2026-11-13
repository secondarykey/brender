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
	deadline time.Time // Keep で動かしているときの期限。ゼロなら期限なし（Start）
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
// Keep と違い、Stop を呼ぶまで止まらない。
func Start(interval time.Duration) {
	mu.Lock()
	defer mu.Unlock()
	deadline = time.Time{}
	if running {
		return
	}
	startLocked(interval)
}

// Keep は収集を ttl のあいだ続ける。止まっていれば interval で動かし始め、
// 動いていれば期限を延ばすだけ（interval は動かし始めたときのものが使われる）。
// ttl のあいだに次の Keep が来なければ、収集は自分で止まる。
// 見ている人がいるあいだだけ動かすためのもので、見る側は ttl より短い間隔で呼び続ける。
//
// すでに動いていたときは直近の値を返す。動かし始めたときは nil を返す
// （最初の値はすぐ collect され、callback で届く）。
func Keep(interval, ttl time.Duration) *Stats {
	mu.Lock()
	defer mu.Unlock()
	deadline = time.Now().Add(ttl)
	if running {
		s := latest
		return &s
	}
	startLocked(interval)
	return nil
}

func startLocked(interval time.Duration) {
	stopCh = make(chan struct{})
	running = true

	initGPU()

	go pollLoop(interval, stopCh)
}

// Stop halts the periodic stats collection.
func Stop() {
	mu.Lock()
	defer mu.Unlock()
	stopLocked()
}

func stopLocked() {
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
			if expired(stop) {
				return
			}
			collect()
		}
	}
}

// expired は Keep の期限が過ぎていれば収集を止めて true を返す。
// stop が今の stopCh でない（すでに止められ、動かし直された）ときは何もしない。
func expired(stop chan struct{}) bool {
	mu.Lock()
	defer mu.Unlock()
	if stopCh != stop || deadline.IsZero() || time.Now().Before(deadline) {
		return false
	}
	stopLocked()
	return true
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
