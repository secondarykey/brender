package rest

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

type handlerFunc func(body json.RawMessage) (any, error)

type Handler struct {
	mux    *http.ServeMux
	routes map[string]handlerFunc
}

func NewHandler() *Handler {
	h := &Handler{
		mux:    http.NewServeMux(),
		routes: make(map[string]handlerFunc),
	}
	h.registerRoutes()
	h.mux.HandleFunc("POST /api/{service}/{method}", h.handleAPI)
	return h
}

func (h *Handler) register(service, method string, fn handlerFunc) {
	key := service + "/" + method
	h.routes[key] = fn
}

func (h *Handler) handleAPI(w http.ResponseWriter, r *http.Request) {
	service := r.PathValue("service")
	method := r.PathValue("method")
	key := service + "/" + method

	fn, ok := h.routes[key]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": fmt.Sprintf("unknown endpoint: %s/%s", service, method),
		})
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	if len(body) == 0 {
		body = []byte("{}")
	}

	data, err := fn(json.RawMessage(body))
	if err != nil {
		slog.Warn("REST API error", "endpoint", key, "error", err)
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func toSnake(s string) string {
	return strings.ReplaceAll(s, "-", "_")
}
