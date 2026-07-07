package log

import (
	"context"
	"log/slog"
)

// ── requestHandler ───────────────────────────────────────
// ctx に載せた相関情報（request_id / user / job_id）を属性として付与し、
// 次の Handler に委譲するデコレータ。ctx の扱いはこの層に集約し、出力ハンドラ
// （simpleHandler 等）は ctx を意識しなくてよい。
// 値の格納は WithRequestID / WithUser / WithJob を使う。

type ctxKey int

const (
	keyRequestID ctxKey = iota
	keyUserID
	keyJobID
)

// WithRequestID は ctx にリクエストIDを載せる。
func WithRequestID(ctx context.Context, v string) context.Context {
	return context.WithValue(ctx, keyRequestID, v)
}

// WithUser は ctx にユーザIDを載せる。
func WithUser(ctx context.Context, v string) context.Context {
	return context.WithValue(ctx, keyUserID, v)
}

// WithJob は ctx にジョブIDを載せる。
func WithJob(ctx context.Context, v string) context.Context {
	return context.WithValue(ctx, keyJobID, v)
}

type requestHandler struct {
	next slog.Handler
}

func (h requestHandler) Enabled(ctx context.Context, l slog.Level) bool {
	return h.next.Enabled(ctx, l)
}

func (h requestHandler) Handle(ctx context.Context, r slog.Record) error {
	if v, _ := ctx.Value(keyRequestID).(string); v != "" {
		r.AddAttrs(slog.String("request_id", v))
	}
	if v, _ := ctx.Value(keyUserID).(string); v != "" {
		r.AddAttrs(slog.String("user", v))
	}
	if v, _ := ctx.Value(keyJobID).(string); v != "" {
		r.AddAttrs(slog.String("job_id", v))
	}
	return h.next.Handle(ctx, r)
}

func (h requestHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return requestHandler{next: h.next.WithAttrs(attrs)}
}

func (h requestHandler) WithGroup(name string) slog.Handler {
	return requestHandler{next: h.next.WithGroup(name)}
}
