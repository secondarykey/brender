package rest

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/log"
	"github.com/secondarykey/brender/model"
)

// ブラウザからの Wails のバインディング呼び出し（POST /wails/runtime）の口。
//
// 実際の処理は Wails の配信（自作の Transport が ServeAssets で受け取る handler）に任せる。
// ここでは、ブラウザから通してよいものだけを通す:
//   - 通す object は「サービスのメソッド呼び出し」と「その取り消し」だけ。
//     Wails の決まった API（Application.Quit・Events.Emit など）はウィンドウ無しでも通ってしまうため断る
//   - チャンクで分けた送り方は中身を確かめられないため断る
//   - ウィンドウを名乗るヘッダーは消す（ブラウザが偽れるため）
//   - ctx にブラウザからの印（api.WithBrowser）を付ける

// Wails の runtime の object 番号（wails v3 pkg/application/messageprocessor.go）
const (
	runtimeObjectCall       = 0
	runtimeObjectCancelCall = 10
)

// Wails の runtime の本文の上限（wails v3 pkg/application/transport_http.go の maxRuntimeBodyBytes）
const maxRuntimeBodyBytes = 64 << 20

// SetRuntimeHandler は Wails の配信の handler を差し込む。自作の Transport の ServeAssets から呼ぶ。
func (s *Server) SetRuntimeHandler(h http.Handler) {
	s.runtimeMu.Lock()
	defer s.runtimeMu.Unlock()
	s.runtime = h
}

func (s *Server) runtimeHandler() http.Handler {
	s.runtimeMu.RLock()
	defer s.runtimeMu.RUnlock()
	return s.runtime
}

// handleRuntimeScript は /wails/runtime.js など、Wails の配信のスクリプトを返す。
func (s *Server) handleRuntimeScript(w http.ResponseWriter, r *http.Request) {
	h := s.runtimeHandler()
	if h == nil {
		http.NotFound(w, r)
		return
	}
	h.ServeHTTP(w, r)
}

// handleRuntimeCall は POST /wails/runtime を確かめてから Wails の配信へ渡す。
func (s *Server) handleRuntimeCall(w http.ResponseWriter, r *http.Request) {
	h := s.runtimeHandler()
	if h == nil {
		http.Error(w, "runtime not ready", http.StatusServiceUnavailable)
		return
	}

	if r.Header.Get("x-wails-chunk-id") != "" {
		http.Error(w, "chunked runtime request is not allowed", http.StatusBadRequest)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxRuntimeBodyBytes))
	if err != nil {
		http.Error(w, "failed to read body", http.StatusRequestEntityTooLarge)
		return
	}
	var req struct {
		Object *int `json:"object"`
	}
	if err := json.Unmarshal(body, &req); err != nil || req.Object == nil {
		http.Error(w, "invalid runtime request", http.StatusBadRequest)
		return
	}
	if *req.Object != runtimeObjectCall && *req.Object != runtimeObjectCancelCall {
		log.Warnf("runtime: object %d from browser is not allowed", *req.Object)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// ユーザ管理が有効なら、ここに来る前に authMiddleware がユーザを入れている。
	// 入っていなければ通さない（ctx にユーザが無いと api 層は owner とみなすため）。
	if _, ok := model.UserFromContext(r.Context()); !ok {
		if enabled, err := api.IsAuthEnabled(); err != nil || enabled {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
	}

	// 監査カラム用（認証無効時は Guest）。Wails はメソッドを同じ goroutine で呼ぶ
	if !model.IsGoroutineUserSet() {
		model.SetGoroutineUser(model.UserIDGuest)
		defer model.ClearGoroutineUser()
	}

	r.Header.Del("x-wails-window-id")
	r.Header.Del("x-wails-window-name")
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	h.ServeHTTP(w, r.WithContext(api.WithBrowser(r.Context())))
}
