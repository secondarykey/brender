package rest

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// handleUploadFile はブラウザからの .blend ファイルのアップロードを受ける（multipart）。
// Wails のバインディングの本文には上限があり、進み具合も取れないため、この口だけは REST のまま。
func handleUploadFile(w http.ResponseWriter, r *http.Request) {
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
