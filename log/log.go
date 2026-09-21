package log

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/secondarykey/brender/config"
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

	handler := requestHandler{next: &simpleHandler{w: logFile, level: &logLevel}}
	logger := slog.New(handler)
	slog.SetDefault(logger)
	gLogger = logger

	return logger, nil
}

func Enabled(lv slog.Level) bool {
	return gLogger.Enabled(gCtx, lv)
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

// ── Context 版 ───────────────────────────────────────────
// 呼び出し側の ctx をそのまま渡し、requestHandler が ctx 内の相関情報
// （request_id / user / job_id）を属性として付与する。グローバル gCtx に
// 依存しないため、HTTP リクエストやジョブ単位のログ追跡に使う。
// メッセージは既存の Info 等と同じ printf 形式。

func TraceContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, LevelTrace, msg, args...)
}

func DebugContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, slog.LevelDebug, msg, args...)
}

func InfoContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, slog.LevelInfo, msg, args...)
}

func NoticeContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, LevelNotice, msg, args...)
}

func WarnContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, slog.LevelWarn, msg, args...)
}

func ErrorContext(ctx context.Context, msg string, args ...interface{}) {
	put(ctx, slog.LevelError, msg, args...)
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
