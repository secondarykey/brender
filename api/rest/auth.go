package rest

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/log"
	"github.com/ikascrew/brender/model"
)

const sessionCookieName = "brender_session"

// authMiddleware はセッションCookieを検証し、認証済みユーザを goroutine に紐付ける。
// 認証不要のパス（ログイン、パスワードリセット、静的ファイル等）はスキップする。
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 認証不要のパス
		if isPublicPath(path) {
			next.ServeHTTP(w, r)
			return
		}

		// 認証が有効か確認
		authEnabled, err := api.IsAuthEnabled()
		if err != nil {
			log.Error("authMiddleware: %v", err)
			next.ServeHTTP(w, r)
			return
		}
		if !authEnabled {
			// 認証無効時は Guest ユーザで処理
			next.ServeHTTP(w, r)
			return
		}

		// セッション Cookie を取得
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			if handleUnauthorized(w, r, path) {
				return // API → 401 を返して終了
			}
			// ページリクエスト → SPA を返す（React側でログイン画面を表示）
			next.ServeHTTP(w, r)
			return
		}

		// セッションを検証
		user, err := api.ValidateSession(cookie.Value)
		if err != nil {
			log.Error("authMiddleware validate session: %v", err)
			if handleUnauthorized(w, r, path) {
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		if user == nil {
			// セッション無効 → Cookie を削除
			clearSessionCookie(w)
			if handleUnauthorized(w, r, path) {
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		// 認証済み: 権限判定用に ctx へ、監査カラム用に goroutine-local へユーザを紐付け
		model.SetGoroutineUser(user.ID)
		defer model.ClearGoroutineUser()

		next.ServeHTTP(w, r.WithContext(model.WithUser(r.Context(), user.ID)))
	})
}

// isPublicPath は認証不要のパスか判定する。
func isPublicPath(path string) bool {
	// ログイン API
	if path == "/api/auth/login" || path == "/api/auth/is_auth_enabled" {
		return true
	}
	// パスワードリセットページ・API
	if strings.HasPrefix(path, "/user/reset/") {
		return true
	}
	if path == "/api/auth/validate_reset_token" || path == "/api/auth/reset_password" {
		return true
	}
	// Wails ランタイムスタブ
	if strings.HasPrefix(path, "/wails/") {
		return true
	}
	// SSE イベント（認証チェックは行わない — ブラウザの EventSource は Cookie を自動送信）
	// 静的ファイル（js, css, assets 等）
	if hasStaticExtension(path) {
		return true
	}
	return false
}

// hasStaticExtension は静的ファイルの拡張子か判定する。
func hasStaticExtension(path string) bool {
	exts := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map"}
	for _, ext := range exts {
		if strings.HasSuffix(path, ext) {
			return true
		}
	}
	return false
}

// handleUnauthorized はAPI・リソース呼び出しに401を返す。ページリクエストの場合は false を返し、
// 呼び出し元で SPA の index.html を返すようにする（React側でログイン画面を表示）。
// /_movie（ファイル配信）と /events（SSE）は SPA ではなくリソースのため 401 を返す。
func handleUnauthorized(w http.ResponseWriter, r *http.Request, path string) bool {
	if strings.HasPrefix(path, "/api/") || path == "/_movie" || path == "/events" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
		return true // レスポンス済み
	}
	return false // SPA を返す必要あり
}

// setSessionCookie はセッション Cookie をセットする。
func setSessionCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 60 * 60, // 30日
	})
}

// clearSessionCookie はセッション Cookie を削除する。
func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

// handleLogin はログイン API を処理し、セッション Cookie をセットする。
func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var p struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	result, err := api.Login(p.Name, p.Password)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}

	setSessionCookie(w, result.SessionID)
	writeJSON(w, http.StatusOK, map[string]any{"data": result.User})
}

// handleLogout はログアウト API を処理し、セッション Cookie を削除する。
func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie(sessionCookieName)
	if err == nil && cookie.Value != "" {
		api.Logout(cookie.Value)
	}

	clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"data": "ok"})
}

// handleResetPage はパスワードリセットページのHTMLを返す。
func handleResetPage(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimPrefix(r.URL.Path, "/user/reset/")
	if token == "" {
		http.Error(w, "invalid token", http.StatusBadRequest)
		return
	}

	if r.Method == http.MethodGet {
		// トークン検証
		user, err := api.ValidateResetToken(token)
		if err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, resetPageHTML(token, "", err.Error(), true))
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, resetPageHTML(token, user.DisplayName, "", false))
		return
	}

	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, resetPageHTML(token, "", "invalid form data", false))
			return
		}

		password := r.FormValue("password")
		confirm := r.FormValue("confirm")

		err := api.ResetPassword(token, password, confirm)
		if err != nil {
			// トークンが有効かを再確認してユーザ名を取得
			user, _ := api.ValidateResetToken(token)
			displayName := ""
			if user != nil {
				displayName = user.DisplayName
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, resetPageHTML(token, displayName, err.Error(), false))
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, resetSuccessHTML())
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// handleValidateResetToken はリセットトークンの検証APIを提供する。
func handleValidateResetToken(w http.ResponseWriter, r *http.Request) {
	var p struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	user, err := api.ValidateResetToken(p.Token)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": user})
}

// handleResetPasswordAPI はパスワードリセットのAPIを提供する。
func handleResetPasswordAPI(w http.ResponseWriter, r *http.Request) {
	var p struct {
		Token    string `json:"token"`
		Password string `json:"password"`
		Confirm  string `json:"confirm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if err := api.ResetPassword(p.Token, p.Password, p.Confirm); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": "ok"})
}

// handleGetMe は現在のセッションのユーザ情報を返す。
func handleGetMe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		writeJSON(w, http.StatusOK, map[string]any{"data": nil})
		return
	}
	user, err := api.ValidateSession(cookie.Value)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"error": err.Error()})
		return
	}
	// 実効ロールを JSON レスポンスに反映（空やシステムユーザ向け）
	if user != nil {
		user.Role = user.EffectiveRole()
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": user})
}

// ── HTML テンプレート ──────────────────────────────────────

func resetPageHTML(token, displayName, errorMsg string, expired bool) string {
	errorDiv := ""
	if errorMsg != "" {
		errorDiv = fmt.Sprintf(`<div class="error">%s</div>`, escapeHTML(errorMsg))
	}

	formHTML := ""
	if !expired {
		formHTML = fmt.Sprintf(`
      <form method="POST" action="/user/reset/%s">
        <div class="field">
          <label>New Password</label>
          <input type="password" name="password" required minlength="8" autofocus
                 placeholder="8 characters or more" />
        </div>
        <div class="field">
          <label>Confirm Password</label>
          <input type="password" name="confirm" required minlength="8"
                 placeholder="Enter the same password" />
        </div>
        <button type="submit">Set Password</button>
      </form>`, escapeHTML(token))
	}

	userInfo := ""
	if displayName != "" {
		userInfo = fmt.Sprintf(`<p class="user-info">Setting password for: <strong>%s</strong></p>`, escapeHTML(displayName))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brender - Set Password</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a1a; color: rgba(255,255,255,0.87);
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh; padding: 20px;
  }
  .card {
    background: #222; border-radius: 12px; padding: 40px;
    max-width: 400px; width: 100%%;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  .user-info { color: rgba(255,255,255,0.6); margin-bottom: 20px; font-size: 0.9rem; }
  .field { margin-bottom: 16px; }
  label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: rgba(255,255,255,0.6); }
  input[type="password"] {
    width: 100%%; height: 40px; padding: 0 12px;
    background: #1e1e1e; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px; color: rgba(255,255,255,0.87); font-size: 1rem;
  }
  input:focus { outline: none; border-color: #4a7cdc; }
  button {
    width: 100%%; height: 42px; background: #27ae60; color: white;
    border: none; border-radius: 6px; font-size: 1rem; cursor: pointer;
    margin-top: 8px;
  }
  button:hover { background: #2ecc71; }
  .error {
    background: rgba(192,57,43,0.15); color: #e74c3c;
    padding: 10px 14px; border-radius: 6px; margin-bottom: 16px;
    font-size: 0.9rem;
  }
</style>
</head>
<body>
<div class="card">
  <h1>Set Password</h1>
  %s
  %s
  %s
</div>
</body>
</html>`, userInfo, errorDiv, formHTML)
}

func resetSuccessHTML() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brender - Password Set</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a1a; color: rgba(255,255,255,0.87);
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh; padding: 20px;
  }
  .card {
    background: #222; border-radius: 12px; padding: 40px;
    max-width: 400px; width: 100%;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    text-align: center;
  }
  h1 { font-size: 1.5rem; margin-bottom: 12px; color: #27ae60; }
  p { color: rgba(255,255,255,0.6); line-height: 1.6; }
  .check { font-size: 3rem; margin-bottom: 16px; }
  .login-link {
    display: inline-block; margin-top: 20px; padding: 10px 28px;
    background: #4a7cdc; color: #fff; text-decoration: none;
    border-radius: 6px; font-size: 1rem;
  }
  .login-link:hover { background: #5a8cec; }
</style>
</head>
<body>
<div class="card">
  <div class="check">&#10003;</div>
  <h1>Password Set Successfully</h1>
  <p>You can now log in with your new password.</p>
  <a href="/" class="login-link">Log In</a>
</div>
</body>
</html>`
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

// cleanupExpiredAuthData は定期的に期限切れのセッションとトークンをクリーンアップする。
func cleanupExpiredAuthData() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			model.CleanExpiredSessions()
		}
	}()
}
