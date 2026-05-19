package exec

import "sync"

type ProgressProvider interface {
	Result() ProcessingResult
}

var (
	progressMu       sync.RWMutex
	progressRegistry = map[string]ProgressProvider{}
)

func RegisterProgress(id string, p ProgressProvider) {
	progressMu.Lock()
	defer progressMu.Unlock()
	progressRegistry[id] = p
}

func UnregisterProgress(id string) {
	progressMu.Lock()
	defer progressMu.Unlock()
	delete(progressRegistry, id)
}

func GetProgress(id string) *ProcessingResult {
	progressMu.RLock()
	defer progressMu.RUnlock()
	p, ok := progressRegistry[id]
	if !ok {
		return nil
	}
	r := p.Result()
	return &r
}
