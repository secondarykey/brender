package log

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	wlog "github.com/wenteasy/log"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// DBName は GORM のログに付ける名前（"logger=db" と出る）。
// 呼び出し元は gorm の中になるので、パッケージではなくこの名前で見分ける。
const DBName = "db"

// DBLogger は GORM の gormlogger.Interface を brender のログへつなぐ。
// GORM が渡すメッセージは printf の形。
type DBLogger struct{}

// NewDBLogger は GORM の Config.Logger に渡すロガーを返す。
func NewDBLogger() gormlogger.Interface {
	return &DBLogger{}
}

func (db *DBLogger) LogMode(lv gormlogger.LogLevel) gormlogger.Interface {
	return db
}

func (db *DBLogger) Info(ctx context.Context, msg string, data ...any) {
	dbput(ctx, LevelInfo, msg, data...)
}

func (db *DBLogger) Warn(ctx context.Context, msg string, data ...any) {
	dbput(ctx, LevelWarn, msg, data...)
}

func (db *DBLogger) Error(ctx context.Context, msg string, data ...any) {
	dbput(ctx, LevelError, msg, data...)
}

func (db *DBLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		sql, rows := fc()
		dbput(ctx, LevelError, "Error: %+v", err)
		dbput(ctx, LevelError, "SQL:%s", sql)
		dbput(ctx, LevelError, "Rows:%d,[%.3fms]", rows, ms(begin))
		return
	}
	lv := LevelDebug
	if err != nil { // RecordNotFound
		lv = LevelInfo
	}
	if !Logger().Enabled(ctx, lv) {
		return // fc() で SQL を組み立てる手間もかけない
	}
	sql, rows := fc()
	if err != nil {
		dbput(ctx, lv, "NotFound SQL:%s", sql)
		return
	}
	dbput(ctx, lv, "SQL:%s", sql)
	dbput(ctx, lv, "Rows:%d,[%.3fms]", rows, ms(begin))
}

func ms(begin time.Time) float64 {
	return float64(time.Since(begin).Microseconds()) / 1e3
}

// dbput は GORM のログを "logger=db" の印を付けて出す。
// 呼び出し元は gorm の中なので、記録の位置は取らない（slog.Logger.Log で書く）。
func dbput(ctx context.Context, lv slog.Level, format string, args ...any) {
	l := Logger()
	if !l.Enabled(ctx, lv) {
		return
	}
	l.With(wlog.LoggerAttr(DBName)).Log(ctx, lv, fmt.Sprintf(format, args...))
}
