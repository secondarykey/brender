package rest

import (
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type runtimeSpy struct {
	called     bool
	fromBrowse bool
	windowID   string
	body       string
}

func (s *runtimeSpy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.called = true
	s.fromBrowse = api.FromBrowser(r.Context())
	s.windowID = r.Header.Get("x-wails-window-id")
	b, _ := io.ReadAll(r.Body)
	s.body = string(b)
	w.Write([]byte("ok"))
}

func newRuntimeTestServer(t *testing.T, auth bool) (http.Handler, *runtimeSpy) {
	t.Helper()
	dsn := filepath.Join(t.TempDir(), "test.db")
	if err := model.Init(dsn); err != nil {
		t.Fatalf("Init: %v", err)
	}
	t.Cleanup(func() { model.Close() })
	if err := model.SetEnvironment(&model.Environment{Server: true, ServerAuth: auth}); err != nil {
		t.Fatalf("SetEnvironment: %v", err)
	}

	assets := fstest.MapFS{"frontend/dist/index.html": {Data: []byte("<html><head></head></html>")}}
	s := NewServer(assets, "127.0.0.1", 0)
	spy := &runtimeSpy{}
	s.SetRuntimeHandler(spy)
	return s.httpServer.Handler, spy
}

func postRuntime(h http.Handler, body string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/wails/runtime", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRuntimeAllowsCallFromBrowser(t *testing.T) {
	h, spy := newRuntimeTestServer(t, false)
	body := `{"object":0,"method":0,"args":{"call-id":"1","methodName":"x"}}`
	rec := postRuntime(h, body, map[string]string{"x-wails-window-id": "1"})
	if rec.Code != http.StatusOK || !spy.called {
		t.Fatalf("call: code=%d called=%v", rec.Code, spy.called)
	}
	if !spy.fromBrowse {
		t.Errorf("ctx に api.WithBrowser の印が無い")
	}
	if spy.windowID != "" {
		t.Errorf("x-wails-window-id が消えていない: %q", spy.windowID)
	}
	if spy.body != body {
		t.Errorf("本文が渡っていない: %q", spy.body)
	}
}

func TestRuntimeRejectsBuiltinAPIs(t *testing.T) {
	h, spy := newRuntimeTestServer(t, false)
	// 2=Application(Quit など) 3=Events(Emit) 6=Window 8=System
	for _, obj := range []string{"1", "2", "3", "5", "6", "8", "9"} {
		spy.called = false
		rec := postRuntime(h, `{"object":`+obj+`,"method":2}`, nil)
		if rec.Code != http.StatusForbidden || spy.called {
			t.Errorf("object %s: code=%d called=%v", obj, rec.Code, spy.called)
		}
	}
	// 10=CancelCall は通す
	spy.called = false
	if rec := postRuntime(h, `{"object":10,"method":0,"args":{"call-id":"1"}}`, nil); rec.Code != http.StatusOK || !spy.called {
		t.Errorf("cancel: code=%d called=%v", rec.Code, spy.called)
	}
}

func TestRuntimeRejectsChunkedAndInvalid(t *testing.T) {
	h, spy := newRuntimeTestServer(t, false)
	rec := postRuntime(h, `{"object":0`, map[string]string{"x-wails-chunk-id": "a", "x-wails-chunk-index": "0", "x-wails-chunk-total": "2"})
	if rec.Code != http.StatusBadRequest || spy.called {
		t.Errorf("chunk: code=%d called=%v", rec.Code, spy.called)
	}
	if rec := postRuntime(h, `not json`, nil); rec.Code != http.StatusBadRequest || spy.called {
		t.Errorf("invalid: code=%d called=%v", rec.Code, spy.called)
	}
}

func TestRuntimeRequiresLogin(t *testing.T) {
	h, spy := newRuntimeTestServer(t, true)
	rec := postRuntime(h, `{"object":0,"method":0,"args":{"call-id":"1"}}`, nil)
	if rec.Code != http.StatusUnauthorized || spy.called {
		t.Errorf("no session: code=%d called=%v", rec.Code, spy.called)
	}
}

func TestWailsOtherPathsAreNotServed(t *testing.T) {
	h, spy := newRuntimeTestServer(t, false)
	for _, p := range []string{"/wails/custom.js", "/wails/stream/x", "/wails/event-payload/x", "/api/environment/get"} {
		req := httptest.NewRequest(http.MethodPost, p, nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound || spy.called {
			t.Errorf("%s: code=%d called=%v", p, rec.Code, spy.called)
		}
	}
	// runtime.js は Wails の配信から返す
	req := httptest.NewRequest(http.MethodGet, "/wails/runtime.js", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if !spy.called {
		t.Errorf("/wails/runtime.js が Wails の配信へ渡っていない (code=%d)", rec.Code)
	}
}
