package api

import (
	"fmt"
	"time"

	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
)

const (
	// パスワードリセットトークンの有効期限（24時間）
	resetTokenDuration = 24 * time.Hour
	// セッションの有効期限（30日）
	sessionDuration = 30 * 24 * time.Hour
)

// ── User ──────────────────────────────────────────────────

func ListUsers() ([]*model.User, error) {
	return model.ListUsers()
}

func GetUser(id string) (*model.User, error) {
	return model.GetUser(id)
}

func CreateUser(name, displayName string) (*model.User, error) {
	if name == "" {
		return nil, xerrors.New("user name is required")
	}
	if displayName == "" {
		displayName = name
	}
	return model.CreateUser(name, displayName)
}

func UpdateUser(id, name, displayName string) (*model.User, error) {
	if name == "" {
		return nil, xerrors.New("user name is required")
	}
	return model.UpdateUser(id, name, displayName)
}

func DeleteUser(id string) error {
	return model.DeleteUser(id)
}

// ── Group ─────────────────────────────────────────────────

func ListGroups() ([]*model.Group, error) {
	return model.ListGroups()
}

func GetGroup(id string) (*model.Group, error) {
	return model.GetGroup(id)
}

func CreateGroup(displayName string) (*model.Group, error) {
	if displayName == "" {
		return nil, xerrors.New("group display name is required")
	}
	return model.CreateGroup(displayName)
}

func UpdateGroup(id, displayName string) (*model.Group, error) {
	if displayName == "" {
		return nil, xerrors.New("group display name is required")
	}
	return model.UpdateGroup(id, displayName)
}

func DeleteGroup(id string) error {
	return model.DeleteGroup(id)
}

// ── UserGroup ─────────────────────────────────────────────

func ListGroupsByUser(userID string) ([]*model.Group, error) {
	return model.ListGroupsByUser(userID)
}

func ListUsersByGroup(groupID string) ([]*model.User, error) {
	return model.ListUsersByGroup(groupID)
}

func AddUserToGroup(userID, groupID string) error {
	return model.AddUserToGroup(userID, groupID)
}

func RemoveUserFromGroup(userID, groupID string) error {
	return model.RemoveUserFromGroup(userID, groupID)
}

// ── Password / Login ─────────────────────────────────────

// UserWithStatus はユーザ情報にパスワード設定状態を付加した構造体。
type UserWithStatus struct {
	*model.User
	HasPassword bool `json:"has_password"`
}

// ListUsersWithStatus はパスワード設定状態付きのユーザ一覧を返す。
func ListUsersWithStatus() ([]*UserWithStatus, error) {
	users, err := model.ListUsers()
	if err != nil {
		return nil, err
	}
	result := make([]*UserWithStatus, len(users))
	for i, u := range users {
		result[i] = &UserWithStatus{
			User:        u,
			HasPassword: u.HasPassword(),
		}
	}
	return result, nil
}

// GenerateResetToken はパスワードリセットトークンを生成し、URLパスを返す。
func GenerateResetToken(userID string) (string, error) {
	user, err := model.GetUser(userID)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", xerrors.New("user not found")
	}

	token, err := model.CreatePasswordResetToken(userID, resetTokenDuration)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("/user/reset/%s", token.Token), nil
}

// ValidateResetToken はリセットトークンが有効かを確認し、対象ユーザ情報を返す。
func ValidateResetToken(token string) (*model.User, error) {
	t, err := model.GetPasswordResetToken(token)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, xerrors.New("invalid or expired token")
	}
	user, err := model.GetUser(t.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, xerrors.New("user not found")
	}
	return user, nil
}

// ResetPassword はトークンを使ってパスワードを設定する。
func ResetPassword(token, password, confirmPassword string) error {
	if password == "" {
		return xerrors.New("password is required")
	}
	if password != confirmPassword {
		return xerrors.New("passwords do not match")
	}
	if len(password) < 8 {
		return xerrors.New("password must be at least 8 characters")
	}

	t, err := model.GetPasswordResetToken(token)
	if err != nil {
		return err
	}
	if t == nil {
		return xerrors.New("invalid or expired token")
	}

	if err := model.SetPassword(t.UserID, password); err != nil {
		return err
	}

	// トークンを使用済みにする
	if err := model.MarkTokenUsed(token); err != nil {
		return err
	}

	return nil
}

// LoginResult はログイン成功時の結果。
type LoginResult struct {
	SessionID string      `json:"session_id"`
	User      *model.User `json:"user"`
}

// Login はログインIDとパスワードで認証し、セッションを作成する。
func Login(name, password string) (*LoginResult, error) {
	if name == "" || password == "" {
		return nil, xerrors.New("login ID and password are required")
	}

	user, err := model.GetUserByName(name)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, xerrors.New("invalid login ID or password")
	}

	ok, err := model.VerifyPassword(user.ID, password)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, xerrors.New("invalid login ID or password")
	}

	session, err := model.CreateSession(user.ID, sessionDuration)
	if err != nil {
		return nil, err
	}

	return &LoginResult{
		SessionID: session.ID,
		User:      user,
	}, nil
}

// Logout はセッションを削除する。
func Logout(sessionID string) error {
	return model.DeleteSession(sessionID)
}

// ValidateSession はセッションの有効性を確認し、ユーザを返す。
func ValidateSession(sessionID string) (*model.User, error) {
	if sessionID == "" {
		return nil, nil
	}
	session, err := model.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, nil
	}
	return model.GetUser(session.UserID)
}

// IsAuthEnabled はサーバ認証が有効かを返す。
func IsAuthEnabled() (bool, error) {
	env, err := model.GetEnv()
	if err != nil {
		return false, err
	}
	if env == nil {
		return false, nil
	}
	return env.ServerAuth, nil
}
