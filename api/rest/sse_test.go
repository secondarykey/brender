package rest

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// Close で配信中の SSE の接続が終わる（終わらないと、終わるときの Server.Shutdown がタイムアウトまで待つ）。
func TestSSEBrokerCloseEndsStreams(t *testing.T) {
	b := NewSSEBroker()
	ts := httptest.NewServer(b.Handler())
	defer ts.Close()

	// ハンドラは最初のイベントまでヘッダを送らないので、Get は終わるまで戻らない。別の goroutine で待つ
	done := make(chan error, 1)
	go func() {
		resp, err := http.Get(ts.URL)
		if err != nil {
			done <- err
			return
		}
		defer resp.Body.Close()
		_, err = io.ReadAll(resp.Body)
		done <- err
	}()

	// 接続が登録されるのを待ってから閉じる
	deadline := time.Now().Add(2 * time.Second)
	for {
		b.mu.RLock()
		n := len(b.clients)
		b.mu.RUnlock()
		if n == 1 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the SSE client was not registered")
		}
		time.Sleep(10 * time.Millisecond)
	}

	b.Close()
	b.Close() // 2 回目も落ちない

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("GET: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the SSE stream did not end after Close")
	}
}
