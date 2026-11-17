package main

import (
	"net/http"
	"sync"

	"github.com/secondarykey/brender/api/rest"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// browserTransport はサーバモードで使う Wails の Transport。
//
// ウィンドウ（WebView）との通り道は既定の HTTPTransport のまま（埋め込んで任せる）。
// それに加えて、Wails から受け取った配信の handler をサーバモードの HTTP サーバへ渡し、
// ブラウザからも POST /wails/runtime でサービスのメソッドを呼べるようにする。
// ブラウザから何を通すか（ログイン・object の絞り込み・ブラウザの印）は rest 側（api/rest/runtime.go）が決める。
//
// WailsEventListener（DispatchWailsEvent）は持たせないこと。持たせるとウィンドウへのイベントの
// 送り方（IPC）が外れる。ブラウザへのイベントは SSE（main.go の emit）で送る。
type browserTransport struct {
	*application.HTTPTransport
	mu      sync.Mutex
	handler http.Handler // Wails から受け取った配信の handler
	server  *rest.Server
}

// newBrowserTransport は、サーバモードかどうかに関わらず作る（サーバは attach で後からつなぐ）。
// application.New（二重起動の確認がある）を DB を開くより前に呼ぶため、ここではまだ DB を読めず、
// サーバモードかどうかが分からない。サーバをつながなければ、既定の HTTPTransport と同じに動く。
func newBrowserTransport(opts ...application.HTTPTransportOption) *browserTransport {
	return &browserTransport{
		HTTPTransport: application.NewHTTPTransport(opts...),
	}
}

// ServeAssets は application.AssetServerTransport の実装。application.New の中で Start の後に呼ばれる。
// HTTP サーバの起動は main.go が（イベントのフックを用意した後で）行う。
func (t *browserTransport) ServeAssets(assetHandler http.Handler) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.handler = assetHandler
	if t.server != nil {
		t.server.SetRuntimeHandler(assetHandler)
	}
	return nil
}

// attach はサーバモードの HTTP サーバをつなぐ（DB を読んでサーバモードと分かったときに main.go が呼ぶ）。
func (t *browserTransport) attach(server *rest.Server) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.server = server
	if t.handler != nil {
		server.SetRuntimeHandler(t.handler)
	}
}
