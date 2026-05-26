package rest

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/ikascrew/brender/log"
)

type handlerFunc func(body json.RawMessage) (any, error)

type Handler struct {
	routes map[string]handlerFunc
}

func NewHandler() *Handler {
	h := &Handler{
		routes: make(map[string]handlerFunc),
	}
	h.registerRoutes()
	return h
}

func (h *Handler) register(service, method string, fn handlerFunc) {
	key := service + "/" + method
	h.routes[key] = fn
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	service := r.PathValue("service")
	method := r.PathValue("method")
	key := service + "/" + method

	start := time.Now()

	fn, ok := h.routes[key]
	if !ok {
		log.Info("REST 404 %s", key)
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": fmt.Sprintf("unknown endpoint: %s/%s", service, method),
		})
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Warn("REST %s read body error: %v", key, err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	if len(body) == 0 {
		body = []byte("{}")
	}

	data, err := fn(json.RawMessage(body))
	elapsed := time.Since(start)
	if err != nil {
		log.Warn("REST %s error: %v (%s)", key, err, elapsed)
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}

	log.Info("REST %s (%s)", key, elapsed)
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
