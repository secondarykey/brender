package model

import (
	"context"
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

// auditCtxKey は監査カラム（CreatedBy / UpdatedBy）に残すユーザIDのキー。
type auditCtxKey struct{}

// WithAuditUser は ctx に「記録に残すユーザ」を紐付ける。権限判定には使わない。
// 権限と記録のユーザを分けたいときに使う:
//   - バックグラウンドの処理は owner の権限（api.SystemContext）で動くが、記録には元の操作者を残す
//   - 認証なしのブラウザからの操作は、権限のユーザを持たないまま記録には guest を残す
func WithAuditUser(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, auditCtxKey{}, userID)
}

// AuditUser は監査カラムに残すユーザIDを返す。
// WithAuditUser の値 → WithUser の値 → owner の順で決める
// （どちらも無いのはデスクトップのウィンドウからの操作で、使っているのは owner 1人）。
// 書き込む model の関数は ctx を受け取って db.WithContext(ctx) を通すこと（model.go のコールバックがこれを呼ぶ）。
func AuditUser(ctx context.Context) string {
	if ctx != nil {
		if v, ok := ctx.Value(auditCtxKey{}).(string); ok && v != "" {
			return v
		}
	}
	if id, ok := UserFromContext(ctx); ok {
		return id
	}
	return UserIDOwner
}
