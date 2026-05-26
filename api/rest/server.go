package rest

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"github.com/ikascrew/brender/log"
)

type Server struct {
	httpServer *http.Server
	broker     *SSEBroker
	handler    *Handler
}

func NewServer(assets fs.FS, host string, port int) *Server {
	handler := NewHandler()
	broker := NewSSEBroker()

	mux := http.NewServeMux()

	mux.Handle("POST /api/{service}/{method}", handler)
	mux.Handle("GET /events", broker.Handler())

	// Wails ランタイムのスタブ — ブラウザモードでは不要だが、
	// ビルド済み JS が @wailsio/runtime 経由でリクエストするためスタブを返す。
	// POST（IPC 呼び出し）には空 JSON、GET（スクリプト読み込み）には空 JS を返す。
	mux.HandleFunc("/wails/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("{}\n"))
			return
		}
		w.Header().Set("Content-Type", "application/javascript")
		w.Write([]byte("// wails runtime stub for server mode\n"))
	})

	distFS, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Error("failed to get frontend/dist sub-filesystem: %v", err)
		distFS = assets
	}

	fileServer := http.FileServerFS(distFS)
	mux.Handle("/", spaHandler(fileServer, distFS))

	// ローカル動画ファイル配信
	mux.HandleFunc("GET /_movie", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Query().Get("path")
		if p == "" || !filepath.IsAbs(p) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		http.ServeFile(w, r, p)
	})

	s := &Server{
		httpServer: &http.Server{
			Addr:    fmt.Sprintf("%s:%d", host, port),
			Handler: requestLogger(mux),
		},
		broker:  broker,
		handler: handler,
	}
	return s
}

func (s *Server) Broker() *SSEBroker {
	return s.broker
}

func (s *Server) Start() error {
	ln, err := net.Listen("tcp", s.httpServer.Addr)
	if err != nil {
		return fmt.Errorf("server listen error: %w", err)
	}
	log.Info("HTTP server started on %s", ln.Addr().String())
	go func() {
		if err := s.httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Error("HTTP server error: %v", err)
		}
	}()
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

// serverModeScript は index.html の <head> 内に注入されるスクリプト。
// @wailsio/runtime がバンドルに含まれていると window._wails がセットされるため、
// サーバモードであることを別フラグで明示する。
const serverModeScript = `<script>window.__brender_server_mode=true</script>`

func spaHandler(fileServer http.Handler, fsys fs.FS) http.Handler {
	var indexOnce sync.Once
	var indexHTML []byte

	loadIndex := func() {
		raw, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			log.Error("failed to read index.html: %v", err)
			return
		}
		indexHTML = bytes.Replace(raw, []byte("<head>"), []byte("<head>"+serverModeScript), 1)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// 実ファイルが存在すればそのまま配信
		if path != "" {
			if f, err := fsys.Open(path); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// index.html を返す（サーバモードフラグ注入済み）
		indexOnce.Do(loadIndex)
		if indexHTML == nil {
			http.Error(w, "index.html not found", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/events" {
			log.Debug("HTTP %s %s", r.Method, r.URL.Path)
		}
		next.ServeHTTP(w, r)
	})
}
