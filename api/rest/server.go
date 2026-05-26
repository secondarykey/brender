package rest

import (
	"context"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/ikascrew/brender/log"
)

type Server struct {
	httpServer *http.Server
	broker     *SSEBroker
	handler    *Handler
}

func NewServer(assets fs.FS, port int) *Server {
	handler := NewHandler()
	broker := NewSSEBroker()

	mux := http.NewServeMux()

	mux.Handle("POST /api/{service}/{method}", handler)
	mux.Handle("GET /events", broker.Handler())

	// Wails ランタイムのスタブ — ブラウザモードでは不要だが、
	// ビルド済み JS が @wailsio/runtime 経由でリクエストするため空モジュールを返す
	mux.HandleFunc("/wails/", func(w http.ResponseWriter, r *http.Request) {
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
			Addr:    fmt.Sprintf(":%d", port),
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

func spaHandler(fileServer http.Handler, fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		if path == "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// ファイルが実在すればそのまま配信
		if f, err := fsys.Open(path); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// 存在しないパスは index.html にフォールバック（SPA ルーティング）
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// API と SSE のログは各ハンドラ内で出力するため静的ファイルのみここでログ
		if !strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/events" {
			log.Debug("HTTP %s %s", r.Method, r.URL.Path)
		}
		next.ServeHTTP(w, r)
	})
}
