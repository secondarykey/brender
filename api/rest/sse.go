package rest

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
)

type sseEvent struct {
	Name string `json:"name"`
	Data any    `json:"data"`
}

type SSEBroker struct {
	mu      sync.RWMutex
	clients map[chan sseEvent]struct{}
}

func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		clients: make(map[chan sseEvent]struct{}),
	}
}

func (b *SSEBroker) Emit(name string, data any) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	ev := sseEvent{Name: name, Data: data}
	for ch := range b.clients {
		select {
		case ch <- ev:
		default:
		}
	}
}

func (b *SSEBroker) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		ch := make(chan sseEvent, 16)
		b.mu.Lock()
		b.clients[ch] = struct{}{}
		b.mu.Unlock()

		defer func() {
			b.mu.Lock()
			delete(b.clients, ch)
			b.mu.Unlock()
			close(ch)
		}()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case ev := <-ch:
				data, err := json.Marshal(ev)
				if err != nil {
					slog.Warn("SSE marshal error", "error", err)
					continue
				}
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	}
}
