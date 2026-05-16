package log

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type DBLogger struct {
}

/**
type Interface interface {
    LogMode(LogLevel) Interface
    Info(context.Context, string, ...interface{})
    Warn(context.Context, string, ...interface{})
    Error(context.Context, string, ...interface{})
    Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error)
}
**/

func NewDBLogger() logger.Interface {
	var l DBLogger
	return &l
}

func (db *DBLogger) LogMode(lv logger.LogLevel) logger.Interface {
	return db
}

func (db *DBLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	put(ctx, slog.LevelInfo, msg, data...)
}

func (db *DBLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	put(ctx, slog.LevelWarn, msg, data...)
}

func (db *DBLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	put(ctx, slog.LevelError, msg, data...)
}

func (db *DBLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {

	elapsed := time.Since(begin)
	sql, rows := fc()

	ms := float64(elapsed.Nanoseconds() / 1e6)

	if err != nil {
		//Record NotFound
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			Error("Error: %+v", err)
			put(ctx, slog.LevelError, "SQL:%s", sql)
			put(ctx, slog.LevelError, "Rows:%d,[%.3fms]", rows, ms)
		} else {
			put(ctx, slog.LevelInfo, "NotFound SQL:%s", sql)
		}
	} else {
		put(ctx, slog.LevelDebug, "SQL:%s", sql)
		put(ctx, slog.LevelDebug, "Rows:%d,[%.3fms]", rows, ms)
	}

	return
}
