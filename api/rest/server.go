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

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/log"
)

type Server struct {
	httpServer *http.Server
	broker     *SSEBroker
	addr       string // 実際に待ち受けているアドレス（Start 後）

	// runtime は Wails の配信（/wails/runtime・/wails/runtime.js）。自作の Transport が差し込む
	runtimeMu sync.RWMutex
	runtime   http.Handler
}

func NewServer(assets fs.FS, host string, port int) *Server {
	broker := NewSSEBroker()

	mux := http.NewServeMux()

	// ── 認証関連ルート ──
	// ログイン前にも使うため、Wails のバインディングではなく REST の口にしている
	mux.HandleFunc("POST /api/auth/login", handleLogin)
	mux.HandleFunc("POST /api/auth/logout", handleLogout)
	mux.HandleFunc("GET /api/auth/me", handleGetMe)
	mux.HandleFunc("POST /api/auth/is_auth_enabled", handleIsAuthEnabled)
	mux.HandleFunc("POST /api/auth/validate_reset_token", handleValidateResetToken)
	mux.HandleFunc("POST /api/auth/reset_password", handleResetPasswordAPI)
	mux.HandleFunc("/user/reset/", handleResetPage)

	mux.Handle("GET /events", broker.Handler())
	mux.HandleFunc("POST /api/project/upload_file", handleUploadFile)
	// /api/ のそれ以外は無い（サービスのメソッドは /wails/runtime から呼ぶ）。SPA を返さず 404 にする
	mux.HandleFunc("/api/", http.NotFound)

	s := &Server{broker: broker}

	// Wails のバインディング呼び出し（ブラウザから）。確かめてから Wails の配信へ渡す（runtime.go）。
	// /wails/ のそれ以外は、決めたスクリプトだけを Wails の配信から返し、残りは断る。
	mux.HandleFunc("POST /wails/runtime", s.handleRuntimeCall)
	mux.HandleFunc("GET /wails/runtime.js", s.handleRuntimeScript)
	mux.HandleFunc("/wails/", http.NotFound)

	distFS, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Errorf("failed to get frontend/dist sub-filesystem: %v", err)
		distFS = assets
	}

	fileServer := http.FileServerFS(distFS)
	mux.Handle("/", spaHandler(fileServer, distFS))

	// サムネイル配信。base64 ではなく画像 URL で返すことでブラウザキャッシュ（304）を効かせる。
	// 認証は authMiddleware、アクセス権限とパス解決は api.ServeThumbnailPath が担う。
	mux.HandleFunc("GET /thumbnail", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		path, err := api.ServeThumbnailPath(r.Context(), q.Get("project_id"), q.Get("file_id"), q.Get("workspace_id"))
		if err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if path == "" {
			http.NotFound(w, r)
			return
		}
		// Last-Modified による条件付き取得は http.ServeFile が処理する
		w.Header().Set("Cache-Control", "private, max-age=0, must-revalidate")
		http.ServeFile(w, r, path)
	})

	// ローカル動画ファイル配信。
	// 任意ファイル読み取りを防ぐため、登録済み作業ディレクトリ配下のパスに限定する。
	mux.HandleFunc("GET /_movie", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Query().Get("path")
		if p == "" || !filepath.IsAbs(p) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}
		if err := api.ValidateWorkDirPath(p); err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.ServeFile(w, r, p)
	})

	// 期限切れセッション・トークンの定期クリーンアップ
	cleanupExpiredAuthData()

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf("%s:%d", host, port),
		Handler: requestLogger(authMiddleware(mux)),
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
	s.addr = ln.Addr().String()
	go func() {
		if err := s.httpServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Errorf("HTTP server error: %v", err)
		}
	}()
	return nil
}

// Addr は待ち受けているアドレスを返す。Start 前（や失敗時）は設定したアドレスを返す。
func (s *Server) Addr() string {
	if s.addr != "" {
		return s.addr
	}
	return s.httpServer.Addr
}

// URL はブラウザで開く URL を返す。すべてのインターフェイスで待ち受けているときは localhost で表し、
// all を true にする（LAN の他の機械からはこの機械のアドレスで開く）。
func (s *Server) URL() (url string, all bool) {
	host, port, err := net.SplitHostPort(s.Addr())
	if err != nil {
		return "http://" + s.Addr(), false
	}
	if ip := net.ParseIP(host); host == "" || (ip != nil && ip.IsUnspecified()) {
		host, all = "localhost", true
	}
	return "http://" + net.JoinHostPort(host, port), all
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

// serverModeScript は index.html の <head> 内に注入されるスクリプト。
// @wailsio/runtime がバンドルに含まれていると window._wails がセットされるため、
// ブラウザ（サーバモード）であることを別フラグで明示する。画面の見た目の分かれ道
// （ウィンドウ操作・ダイアログ・イベントの受け方）に使う。
const serverModeScript = `<script>window.__brender_server_mode=true</script>`

func spaHandler(fileServer http.Handler, fsys fs.FS) http.Handler {
	var indexOnce sync.Once
	var indexHTML []byte

	loadIndex := func() {
		raw, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			log.Errorf("failed to read index.html: %v", err)
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
			log.Debugf("HTTP %s %s", r.Method, r.URL.Path)
		}
		next.ServeHTTP(w, r)
	})
}
