package log

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"
)

// simpleHandler はデフォルトの log パッケージに近いシンプルな出力を行う slog.Handler。
// 出力形式: 2006/01/02 15:04:05 [LEVEL] message key=value ...
// 形式はシンプルに保つ。JSON など別形式が必要になった場合はこのハンドラを拡張せず
// 別 Handler を用意する。ctx の扱いは requestHandler に委ねる（ここでは ctx を見ない）。
type simpleHandler struct {
	w     io.Writer
	level *slog.LevelVar
	attrs []slog.Attr // WithAttrs で蓄積した属性（破棄しない）
}

func (h *simpleHandler) Enabled(_ context.Context, l slog.Level) bool {
	return l >= h.level.Level()
}

func (h *simpleHandler) Handle(_ context.Context, r slog.Record) error {
	var b strings.Builder
	fmt.Fprintf(&b, "%s [%s] %s", r.Time.Format(time.RFC3339), levelName(r.Level), r.Message)
	for _, a := range h.attrs {
		writeAttr(&b, a)
	}
	r.Attrs(func(a slog.Attr) bool {
		writeAttr(&b, a)
		return true
	})
	b.WriteByte('\n')
	_, err := io.WriteString(h.w, b.String())
	return err
}

func writeAttr(b *strings.Builder, a slog.Attr) {
	fmt.Fprintf(b, " %s=%v", a.Key, a.Value.Any())
}

func (h *simpleHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	nh := *h
	nh.attrs = append(append([]slog.Attr{}, h.attrs...), attrs...)
	return &nh
}

// WithGroup はグループ未使用のため当面 no-op。属性は破棄しない。
func (h *simpleHandler) WithGroup(_ string) slog.Handler { return h }

func levelName(l slog.Level) string {
	switch {
	case l <= LevelTrace:
		return "TRACE "
	case l <= slog.LevelDebug:
		return "DEBUG "
	case l < LevelNotice:
		return "INFO  "
	case l < slog.LevelWarn:
		return "NOTICE"
	case l < slog.LevelError:
		return "WARN  "
	case l < LevelEmergency:
		return "ERROR "
	default:
		return "EMERGENCY"
	}
}
