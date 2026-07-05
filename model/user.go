package model

import (
	"context"
	"runtime"
	"strconv"
	"strings"
	"sync"
)

// userCtxKey は context に紐付けるユーザIDのキー。
type userCtxKey struct{}

// WithUser は ctx に操作ユーザIDを紐付ける。
// 権限判定はこの ctx 経由のユーザを信頼できる情報源として使う。
func WithUser(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userCtxKey{}, userID)
}

// UserFromContext は ctx に紐付いたユーザIDを返す。未設定なら ok=false。
func UserFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	v, ok := ctx.Value(userCtxKey{}).(string)
	return v, ok && v != ""
}

// defaultUser は Wails モードでのグローバルデフォルトユーザID。
var defaultUser = UserIDOwner

// goroutine ごとのユーザ名を保持する（監査カラム CreatedBy/UpdatedBy 用のベストエフォート）。
// 権限判定には使わない（そちらは context 経由の UserFromContext を使う）。
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

// auditUser は監査カラム用のユーザを返す。
// クエリ ctx に紐付いたユーザを優先し、なければ goroutine-local を使う。
func auditUser(ctx context.Context) string {
	if id, ok := UserFromContext(ctx); ok {
		return id
	}
	return CurrentUser()
}

// IsGoroutineUserSet は現在の goroutine にユーザが紐付いているかを返す。
func IsGoroutineUserSet() bool {
	_, ok := goroutineUser.Load(goroutineID())
	return ok
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
