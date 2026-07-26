package sysmon

import (
	"sync"
	"testing"
	"time"
)

func resetState() {
	mu.Lock()
	defer mu.Unlock()
	running = false
	latest = Stats{}
	callback = nil
	stopCh = nil
}

func TestStartStop(t *testing.T) {
	resetState()

	Start(50 * time.Millisecond)
	time.Sleep(150 * time.Millisecond)
	Stop()

	s := Latest()
	if s.MemTotalMB == 0 {
		t.Error("MemTotalMB should be > 0 after collection")
	}
}

func TestStartIdempotent(t *testing.T) {
	resetState()

	Start(50 * time.Millisecond)
	Start(50 * time.Millisecond) // second call should be no-op
	time.Sleep(100 * time.Millisecond)
	Stop()
	Stop() // second stop should be no-op
}

func TestCallback(t *testing.T) {
	resetState()

	var mu2 sync.Mutex
	var received []Stats

	SetCallback(func(s Stats) {
		mu2.Lock()
		received = append(received, s)
		mu2.Unlock()
	})

	Start(50 * time.Millisecond)
	time.Sleep(200 * time.Millisecond)
	Stop()

	mu2.Lock()
	count := len(received)
	mu2.Unlock()

	if count == 0 {
		t.Error("callback should have been called at least once")
	}
}

func TestLatestReturnsSnapshot(t *testing.T) {
	resetState()

	s := Latest()
	if s.CPUUsage != 0 && s.MemTotalMB != 0 {
		t.Error("Latest() before Start should return zero-value Stats")
	}
}

func TestCollectPopulatesMemory(t *testing.T) {
	resetState()
	initGPU()

	collect()

	s := Latest()
	if s.MemTotalMB == 0 {
		t.Error("collect() should populate MemTotalMB")
	}
	if s.MemUsage <= 0 {
		t.Error("collect() should populate MemUsage > 0")
	}
}
