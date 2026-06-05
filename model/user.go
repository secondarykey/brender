package model

import (
	"runtime"
	"strconv"
	"strings"
	"sync"
)

// ユーザ名定数
const (
	UserOwner = "BrenderOwner"
	UserGuest = "Guest"
)

// defaultUser は Wails モードでのグローバルデフォルトユーザ。
var defaultUser = UserOwner

// goroutine ごとのユーザ名を保持する（REST リクエスト用）
var goroutineUser sync.Map

// SetDefaultUser はグローバルデフォルトユーザを設定する。
func SetDefaultUser(name string) {
	defaultUser = name
}

// SetGoroutineUser は現在の goroutine にユーザ名を紐付ける。
// REST ミドルウェアでリクエスト処理開始時に呼ぶ。
func SetGoroutineUser(name string) {
	goroutineUser.Store(goroutineID(), name)
}

// ClearGoroutineUser は現在の goroutine のユーザ名を解除する。
// REST ミドルウェアでリクエスト処理終了時に呼ぶ。
func ClearGoroutineUser() {
	goroutineUser.Delete(goroutineID())
}

// CurrentUser は現在のユーザ名を返す。
// goroutine 固有の値があればそれを、なければグローバルデフォルトを返す。
func CurrentUser() string {
	if v, ok := goroutineUser.Load(goroutineID()); ok {
		return v.(string)
	}
	return defaultUser
}

// goroutineID は現在の goroutine ID を返す。
func goroutineID() uint64 {
	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	// "goroutine 123 [..."
	s := string(buf[:n])
	s = strings.TrimPrefix(s, "goroutine ")
	s = s[:strings.IndexByte(s, ' ')]
	id, _ := strconv.ParseUint(s, 10, 64)
	return id
}
