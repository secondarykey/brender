package rest

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strings"
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

	distFS, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		slog.Error("failed to get frontend/dist sub-filesystem", "error", err)
		distFS = assets
	}

	mux.Handle("/", spaHandler(http.FileServerFS(distFS)))

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
			Handler: mux,
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
	slog.Info("HTTP server started", "addr", ln.Addr().String())
	go func() {
		if err := s.httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func spaHandler(fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path != "/" && !strings.Contains(path, ".") {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}
