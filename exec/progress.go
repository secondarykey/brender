package exec

import "sync"

var (
	progressMu       sync.RWMutex
	progressRegistry = map[string]*ProcessingWriter{}
)

func RegisterProgress(id string, pw *ProcessingWriter) {
	progressMu.Lock()
	defer progressMu.Unlock()
	progressRegistry[id] = pw
}

func UnregisterProgress(id string) {
	progressMu.Lock()
	defer progressMu.Unlock()
	delete(progressRegistry, id)
}

func GetProgress(id string) *ProcessingResult {
	progressMu.RLock()
	defer progressMu.RUnlock()
	pw, ok := progressRegistry[id]
	if !ok {
		return nil
	}
	r := pw.Result()
	return &r
}
