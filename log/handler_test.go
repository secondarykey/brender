package log

import (
	"context"
	"log/slog"
	"strings"
	"testing"
)

// newTestLogger は buffer に書く requestHandler+simpleHandler 構成のロガーを返す。
func newTestLogger(buf *strings.Builder) *slog.Logger {
	var lv slog.LevelVar
	lv.Set(LevelTrace)
	return slog.New(requestHandler{next: &simpleHandler{w: buf, level: &lv}})
}

// 属性が出力されること（simpleHandler が破棄しない）。
func TestSimpleHandlerEmitsAttrs(t *testing.T) {
	var buf strings.Builder
	logger := newTestLogger(&buf)

	logger.Info("hello", "key", "val", slog.Int("n", 3))

	out := buf.String()
	if !strings.Contains(out, "hello") {
		t.Fatalf("message missing: %q", out)
	}
	if !strings.Contains(out, "key=val") {
		t.Errorf("attr key=val missing: %q", out)
	}
	if !strings.Contains(out, "n=3") {
		t.Errorf("attr n=3 missing: %q", out)
	}
}

// ctx の相関情報が requestHandler により属性化されること。
func TestRequestHandlerInjectsCtx(t *testing.T) {
	var buf strings.Builder
	logger := newTestLogger(&buf)

	ctx := WithJob(WithUser(context.Background(), "usr_abc"), "job_123")
	logger.InfoContext(ctx, "job started")

	out := buf.String()
	if !strings.Contains(out, "user=usr_abc") {
		t.Errorf("user attr missing: %q", out)
	}
	if !strings.Contains(out, "job_id=job_123") {
		t.Errorf("job_id attr missing: %q", out)
	}
}

// ctx に値が無ければ相関属性は付かないこと。
func TestRequestHandlerNoCtxValues(t *testing.T) {
	var buf strings.Builder
	logger := newTestLogger(&buf)

	logger.InfoContext(context.Background(), "plain")

	out := buf.String()
	if strings.Contains(out, "user=") || strings.Contains(out, "job_id=") || strings.Contains(out, "request_id=") {
		t.Errorf("unexpected correlation attrs: %q", out)
	}
}
