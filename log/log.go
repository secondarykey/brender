package log

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/ikascrew/brender/config"
	"golang.org/x/xerrors"
)

// debug = -4 ,info = 0 warn = 4,error = 8

const (
	LevelTrace     slog.Level = -8
	LevelNotice    slog.Level = 2
	LevelEmergency slog.Level = 32
)

var gCtx context.Context
var gLogger *slog.Logger
var logFile *os.File
var logLevel slog.LevelVar

func init() {
	logLevel.Set(LevelNotice)
	gLogger = slog.Default()
}

// Init はログファイルを temp ディレクトリに作成し、slog を設定する。
func Init(ctx context.Context) (*slog.Logger, error) {

	gCtx = ctx

	// 出力先は brender.ini の log_dir を優先。未設定なら temp 配下。
	dir := config.Get().LogDir
	if dir == "" {
		dir = filepath.Join(os.TempDir(), "brender", "logs")
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, xerrors.Errorf("os.MkdirAll() error: %w", err)
	}

	name := time.Now().Format("20060102") + ".log"
	f, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, xerrors.Errorf("os.OpenFile() error: %w", err)
	}
	logFile = f

	handler := &simpleHandler{w: logFile, level: &logLevel}
	logger := slog.New(handler)
	slog.SetDefault(logger)
	gLogger = logger

	return logger, nil
}

func Enabled(lv slog.Level) bool {
	return gLogger.Enabled(gCtx, lv)
}

// simpleHandler はデフォルトの log パッケージに近いシンプルな出力を行う slog.Handler。
// 出力形式: 2006/01/02 15:04:05 [LEVEL] message
type simpleHandler struct {
	w     io.Writer
	level *slog.LevelVar
}

func (h *simpleHandler) Enabled(_ context.Context, l slog.Level) bool {
	return l >= h.level.Level()
}

func (h *simpleHandler) Handle(_ context.Context, r slog.Record) error {
	t := r.Time.Format(time.RFC3339)
	_, err := fmt.Fprintf(h.w, "%s [%s] %s\n", t, levelName(r.Level), r.Message)
	return err
}

// TODO(server): simpleHandler は属性・グループを破棄し、Message のみを出力する。
// マルチユーザのサーバモードでは user/job などの構造化属性でログを識別したいので、
// その用途では属性を出力する別 Handler（JSON 等）に差し替える前提。現状は未対応。
func (h *simpleHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *simpleHandler) WithGroup(_ string) slog.Handler      { return h }

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

// Close はログファイルを閉じる。
func Close() {
	if logFile != nil {
		logFile.Close()
		logFile = nil
	}
}

// Path は現在のログファイルのパスを返す。
// Init が未呼び出しの場合は空文字を返す。
func Path() string {
	if logFile == nil {
		return ""
	}
	return logFile.Name()
}

// SetLevel はログレベルを動的に変更する。
func SetLevel(level slog.Level) {
	logLevel.Set(level)
}

// GetLevel は現在のログレベルを返す。
func GetLevel() slog.Level {
	return logLevel.Level()
}

func SetContext(ctx context.Context) {
	gCtx = ctx
}

func Trace(msg string, args ...interface{}) {
	logf(LevelTrace, msg, args...)
}

func Debug(msg string, args ...interface{}) {
	logf(slog.LevelDebug, msg, args...)
}

func Info(msg string, args ...interface{}) {
	logf(slog.LevelInfo, msg, args...)
}

func Notice(msg string, args ...interface{}) {
	logf(LevelNotice, msg, args...)
}

func Warn(msg string, args ...interface{}) {
	logf(slog.LevelWarn, msg, args...)
}

func Error(msg string, args ...interface{}) {
	logf(slog.LevelError, msg, args...)
}

func logf(lv slog.Level, msg string, args ...interface{}) {
	put(gCtx, lv, msg, args...)
}

func put(ctx context.Context, lv slog.Level, format string, args ...interface{}) {
	if gLogger.Enabled(ctx, lv) {
		msg := fmt.Sprintf(format, args...)
		slog.Log(ctx, lv, msg)
	}
}

// 関数の開始地点に
// defer log.PrintTrace(log.Func("Function Name"))
// と記述することでTraceレベルで"Start"がログに残り、
// 関数終了(defer) 時点で"End"を残すことができる
func PrintTrace(caller string) {
	if gLogger.Enabled(gCtx, LevelTrace) {
		Trace("%s %s", caller, "End")
	}
}

func Func(caller string, args ...interface{}) string {
	if gLogger.Enabled(gCtx, LevelTrace) {
		//pc,file,line,ok  := runtime.Caller(1)
		Trace("%s %s", caller, "Start")
		if len(args) > 0 {
			Trace("Arguments: %s", arguments(args...))
		}
	}
	return caller
}

func arguments(args ...interface{}) string {
	var buf strings.Builder
	for idx, a := range args {
		if idx != 0 {
			buf.WriteString(",")
		}
		buf.WriteString(fmt.Sprintf("%v", a))
	}
	return buf.String()
}

func PrintStackTrace(err error) {
	slog.Error("Error:\n" + stacktrace(err))
	return
}

func NoneStop() {
	if err := recover(); err != nil {
		emergency(err)
	}
}

func stacktrace(err interface{}) string {
	return fmt.Sprintf("%+v", err)
}

// 呼び出した位置を保存可能
func emergency(err interface{}) {
	//0.this
	//1.emergency
	//2.defer
	//3. panic!
	_, file, line, ok := runtime.Caller(3)
	slog.Log(gCtx, LevelEmergency, "Emergency!!\n"+stacktrace(err))
	if ok {
		slog.Log(gCtx, LevelEmergency, "File:"+file)
		slog.Log(gCtx, LevelEmergency, fmt.Sprintf("Line:%d", line))
	}
}
