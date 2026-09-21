package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
)

type handlerFunc func(ctx context.Context, body json.RawMessage) (any, error)

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

// registerAdmin は admin ロール限定のエンドポイントを登録する。
// 設定変更・Blender 登録・ユーザ管理など、システム全体に影響する操作に使う。
func (h *Handler) registerAdmin(service, method string, fn handlerFunc) {
	h.register(service, method, func(ctx context.Context, body json.RawMessage) (any, error) {
		if err := api.RequireAdmin(ctx); err != nil {
			return nil, err
		}
		return fn(ctx, body)
	})
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 認証ミドルウェアで goroutine ユーザが既にセットされている場合はそのまま使用。
	// セットされていなければ（認証無効時など）Guest をフォールバックとしてセットする。
	if !model.IsGoroutineUserSet() {
		model.SetGoroutineUser(model.UserIDGuest)
		defer model.ClearGoroutineUser()
	}

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

	data, err := fn(r.Context(), json.RawMessage(body))
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

func (h *Handler) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	// 認証ミドルウェアで goroutine ユーザが既にセットされている場合はそのまま使用
	if !model.IsGoroutineUserSet() {
		model.SetGoroutineUser(model.UserIDGuest)
		defer model.ClearGoroutineUser()
	}

	start := time.Now()

	if err := r.ParseMultipartForm(512 << 20); err != nil { // 512MB max
		log.Warn("REST upload parse error: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to parse multipart form"})
		return
	}

	projectID := r.FormValue("project_id")
	if projectID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "project_id is required"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Warn("REST upload FormFile error: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file is required"})
		return
	}
	defer file.Close()

	result, err := api.UploadProjectFile(r.Context(), projectID, header.Filename, file)
	elapsed := time.Since(start)
	if err != nil {
		log.Warn("REST upload error: %v (%s)", err, elapsed)
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}

	log.Info("REST project/upload_file %s (%s)", header.Filename, elapsed)
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}
