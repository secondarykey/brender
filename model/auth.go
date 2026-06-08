package model

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math/big"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/xerrors"
	"gorm.io/gorm"
)

// ID プレフィックス
const (
	PrefixUser  = "usr_"
	PrefixGroup = "grp_"
)

// システムID（固定）
const (
	UserIDOwner = "usr_owner"
	UserIDGuest = "usr_guest"
	GroupIDAll  = "grp_all"
)

// アプリレベルのユーザロール
const (
	UserRoleAdmin   = "admin"   // 全操作可能（設定変更・ユーザ管理・プロジェクト作成）
	UserRoleCreator = "creator" // プロジェクト作成可能
	UserRoleViewer  = "viewer"  // 閲覧のみ（プロジェクト作成不可）
)

// AllUserRoles はアプリレベルの全ロール一覧。
var AllUserRoles = []string{UserRoleAdmin, UserRoleCreator, UserRoleViewer}

// base62 文字セット
const base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// randomBase62 は暗号学的に安全なランダム base62 文字列を生成する。
func randomBase62(length int) string {
	b := make([]byte, length)
	max := big.NewInt(int64(len(base62)))
	for i := range b {
		n, _ := rand.Int(rand.Reader, max)
		b[i] = base62[n.Int64()]
	}
	return string(b)
}

// NewUserID はユーザ用の短いユニークIDを生成する。
func NewUserID() string {
	return PrefixUser + randomBase62(8)
}

// NewGroupID はグループ用の短いユニークIDを生成する。
func NewGroupID() string {
	return PrefixGroup + randomBase62(8)
}

// ── User ──────────────────────────────────────────────────

type User struct {
	ID           string `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"uniqueIndex" json:"name"` // ログインID（ASCII限定）
	DisplayName  string `json:"display_name"`             // 表示名
	PasswordHash string `json:"-"`                        // bcrypt ハッシュ（APIレスポンスに含めない）
	Role         string `gorm:"default:''" json:"role"`   // アプリレベルロール（admin/creator/viewer）
	IsSystem     bool   `gorm:"default:false" json:"is_system"`
	MetaFields   `gorm:"embedded"`
}

// HasPassword はパスワードが設定済みかを返す。
func (u *User) HasPassword() bool {
	return u.PasswordHash != ""
}

// EffectiveRole はユーザの実効ロールを返す。
// システムユーザはハードコード、空の場合は creator（後方互換）。
func (u *User) EffectiveRole() string {
	if u.ID == UserIDOwner {
		return UserRoleAdmin
	}
	if u.ID == UserIDGuest {
		return UserRoleViewer
	}
	if u.Role == "" {
		return UserRoleCreator
	}
	return u.Role
}

// CanCreateProject はプロジェクト作成権限を持つかチェックする。
// ユーザ管理（ServerAuth）が無効の場合は全員許可する。
func CanCreateProject(userID string) (bool, error) {
	if userID == UserIDOwner {
		return true, nil
	}
	// ユーザ管理が無効なら全員許可（Guest でもフルアクセス）
	env, err := GetEnv()
	if err != nil {
		return false, err
	}
	if env == nil || !env.ServerAuth {
		return true, nil
	}
	if userID == UserIDGuest {
		return false, nil
	}
	u, err := GetUser(userID)
	if err != nil {
		return false, err
	}
	if u == nil {
		return false, nil
	}
	role := u.EffectiveRole()
	return role == UserRoleAdmin || role == UserRoleCreator, nil
}

// isASCII は文字列がASCII文字のみで構成されているかを判定する。
func isASCII(s string) bool {
	for _, c := range s {
		if c > 127 {
			return false
		}
	}
	return true
}

func ListUsers() ([]*User, error) {
	var users []*User
	if res := db.Order("is_system desc, name asc").Find(&users); res.Error != nil {
		return nil, xerrors.Errorf("ListUsers: %w", res.Error)
	}
	return users, nil
}

func GetUser(id string) (*User, error) {
	var u User
	res := db.First(&u, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetUser: %w", res.Error)
	}
	return &u, nil
}

func CreateUser(name, displayName, role string) (*User, error) {
	id := NewUserID()
	if name == "" {
		name = id
	}
	if !isASCII(name) {
		return nil, xerrors.New("login ID must be ASCII characters only")
	}
	u := &User{
		ID:          id,
		Name:        name,
		DisplayName: displayName,
		Role:        role,
	}
	if res := db.Create(u); res.Error != nil {
		return nil, xerrors.Errorf("CreateUser: %w", res.Error)
	}
	return u, nil
}

func UpdateUser(id, name, displayName, role string) (*User, error) {
	var u User
	if res := db.First(&u, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateUser find: %w", res.Error)
	}
	if u.IsSystem {
		// システムユーザは表示名のみ変更可（ロールはハードコードのため無視）
		u.DisplayName = displayName
	} else {
		if !isASCII(name) {
			return nil, xerrors.New("login ID must be ASCII characters only")
		}
		u.Name = name
		u.DisplayName = displayName
		u.Role = role
	}
	if res := db.Save(&u); res.Error != nil {
		return nil, xerrors.Errorf("UpdateUser save: %w", res.Error)
	}
	return &u, nil
}

func DeleteUser(id string) error {
	var u User
	if res := db.First(&u, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteUser find: %w", res.Error)
	}
	if u.IsSystem {
		return xerrors.New("システムユーザは削除できません")
	}
	// グループ所属も削除
	db.Where("user_id = ?", id).Delete(&UserGroup{})
	if res := db.Delete(&User{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteUser: %w", res.Error)
	}
	return nil
}

// ── Group ─────────────────────────────────────────────────

type Group struct {
	ID          string `gorm:"primaryKey" json:"id"`
	DisplayName string `json:"display_name"` // 表示名
	IsSystem    bool   `gorm:"default:false" json:"is_system"`
	MetaFields  `gorm:"embedded"`
}

func ListGroups() ([]*Group, error) {
	var groups []*Group
	if res := db.Order("is_system desc, display_name asc").Find(&groups); res.Error != nil {
		return nil, xerrors.Errorf("ListGroups: %w", res.Error)
	}
	return groups, nil
}

func GetGroup(id string) (*Group, error) {
	var g Group
	res := db.First(&g, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetGroup: %w", res.Error)
	}
	return &g, nil
}

func CreateGroup(displayName string) (*Group, error) {
	g := &Group{
		ID:          NewGroupID(),
		DisplayName: displayName,
	}
	if res := db.Create(g); res.Error != nil {
		return nil, xerrors.Errorf("CreateGroup: %w", res.Error)
	}
	return g, nil
}

func UpdateGroup(id, displayName string) (*Group, error) {
	var g Group
	if res := db.First(&g, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateGroup find: %w", res.Error)
	}
	g.DisplayName = displayName
	if res := db.Save(&g); res.Error != nil {
		return nil, xerrors.Errorf("UpdateGroup save: %w", res.Error)
	}
	return &g, nil
}

func DeleteGroup(id string) error {
	var g Group
	if res := db.First(&g, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteGroup find: %w", res.Error)
	}
	if g.IsSystem {
		return xerrors.New("システムグループは削除できません")
	}
	// 所属レコードも削除
	db.Where("group_id = ?", id).Delete(&UserGroup{})
	if res := db.Delete(&Group{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteGroup: %w", res.Error)
	}
	return nil
}

// ── UserGroup（多対多） ──────────────────────────────────────

type UserGroup struct {
	UserID  string `gorm:"primaryKey" json:"user_id"`
	GroupID string `gorm:"primaryKey" json:"group_id"`
	MetaFields `gorm:"embedded"`
}

// ListGroupsByUser はユーザが所属するグループ一覧を返す。
// All グループは暗黙的に含まれるため、明示的に先頭に追加する。
func ListGroupsByUser(userID string) ([]*Group, error) {
	var ugs []UserGroup
	if res := db.Where("user_id = ?", userID).Find(&ugs); res.Error != nil {
		return nil, xerrors.Errorf("ListGroupsByUser: %w", res.Error)
	}

	// All グループを先頭に
	allGroup, err := GetGroup(GroupIDAll)
	if err != nil {
		return nil, err
	}
	groups := []*Group{}
	if allGroup != nil {
		groups = append(groups, allGroup)
	}

	if len(ugs) > 0 {
		ids := make([]string, 0, len(ugs))
		for _, ug := range ugs {
			if ug.GroupID != GroupIDAll { // All は既に追加済み
				ids = append(ids, ug.GroupID)
			}
		}
		if len(ids) > 0 {
			var extra []*Group
			if res := db.Where("id IN ?", ids).Order("display_name asc").Find(&extra); res.Error != nil {
				return nil, xerrors.Errorf("ListGroupsByUser groups: %w", res.Error)
			}
			groups = append(groups, extra...)
		}
	}
	return groups, nil
}

// ListUsersByGroup はグループに所属するユーザ一覧を返す。
// All グループの場合は全ユーザを返す。
func ListUsersByGroup(groupID string) ([]*User, error) {
	if groupID == GroupIDAll {
		return ListUsers()
	}
	var ugs []UserGroup
	if res := db.Where("group_id = ?", groupID).Find(&ugs); res.Error != nil {
		return nil, xerrors.Errorf("ListUsersByGroup: %w", res.Error)
	}
	if len(ugs) == 0 {
		return []*User{}, nil
	}
	ids := make([]string, len(ugs))
	for i, ug := range ugs {
		ids[i] = ug.UserID
	}
	var users []*User
	if res := db.Where("id IN ?", ids).Order("name asc").Find(&users); res.Error != nil {
		return nil, xerrors.Errorf("ListUsersByGroup users: %w", res.Error)
	}
	return users, nil
}

// AddUserToGroup はユーザをグループに追加する。
func AddUserToGroup(userID, groupID string) error {
	if groupID == GroupIDAll {
		return xerrors.New("All グループへの手動追加は不要です（全ユーザが自動参加）")
	}
	ug := &UserGroup{UserID: userID, GroupID: groupID}
	if res := db.FirstOrCreate(ug, "user_id = ? AND group_id = ?", userID, groupID); res.Error != nil {
		return xerrors.Errorf("AddUserToGroup: %w", res.Error)
	}
	return nil
}

// RemoveUserFromGroup はユーザをグループから除外する。
func RemoveUserFromGroup(userID, groupID string) error {
	if groupID == GroupIDAll {
		return xerrors.New("All グループからの除外はできません")
	}
	if res := db.Where("user_id = ? AND group_id = ?", userID, groupID).Delete(&UserGroup{}); res.Error != nil {
		return xerrors.Errorf("RemoveUserFromGroup: %w", res.Error)
	}
	return nil
}

// ── Password ─────────────────────────────────────────────

// ClearPassword はユーザのパスワードをクリアする（ログイン不可状態にする）。
func ClearPassword(userID string) error {
	if res := db.Model(&User{}).Where("id = ?", userID).Update("password_hash", ""); res.Error != nil {
		return xerrors.Errorf("ClearPassword: %w", res.Error)
	}
	return nil
}

// SetPassword はユーザのパスワードを bcrypt ハッシュ化して保存する。
func SetPassword(userID, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return xerrors.Errorf("SetPassword hash: %w", err)
	}
	if res := db.Model(&User{}).Where("id = ?", userID).Update("password_hash", string(hash)); res.Error != nil {
		return xerrors.Errorf("SetPassword save: %w", res.Error)
	}
	return nil
}

// VerifyPassword はユーザのパスワードを検証する。
func VerifyPassword(userID, password string) (bool, error) {
	var u User
	if res := db.First(&u, "id = ?", userID); res.Error != nil {
		return false, xerrors.Errorf("VerifyPassword: %w", res.Error)
	}
	if u.PasswordHash == "" {
		return false, nil
	}
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	if err == bcrypt.ErrMismatchedHashAndPassword {
		return false, nil
	}
	if err != nil {
		return false, xerrors.Errorf("VerifyPassword compare: %w", err)
	}
	return true, nil
}

// GetUserByName はログインID（Name）でユーザを検索する。
func GetUserByName(name string) (*User, error) {
	var u User
	res := db.First(&u, "name = ?", name)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetUserByName: %w", res.Error)
	}
	return &u, nil
}

// ── PasswordResetToken ──────────────────────────────────

// PasswordResetToken はパスワード設定用のワンタイムトークン。
type PasswordResetToken struct {
	Token     string     `gorm:"primaryKey" json:"token"`
	UserID    string     `json:"user_id"`
	ExpiresAt time.Time  `json:"expires_at"`
	Used      bool       `gorm:"default:false" json:"used"`
	CreatedAt *time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// generateSecureToken はセキュアなランダムトークンを生成する。
func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// GetActiveResetTokenByUser はユーザの有効な（未使用かつ期限内の）トークンを返す。
func GetActiveResetTokenByUser(userID string) (*PasswordResetToken, error) {
	var t PasswordResetToken
	res := db.Where("user_id = ? AND used = ? AND expires_at > ?", userID, false, time.Now()).
		Order("created_at desc").First(&t)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetActiveResetTokenByUser: %w", res.Error)
	}
	return &t, nil
}

// CreatePasswordResetToken はパスワードリセットトークンを作成する。
// 既存の未使用トークンは無効化する。
func CreatePasswordResetToken(userID string, duration time.Duration) (*PasswordResetToken, error) {
	// 既存の未使用トークンを無効化
	db.Model(&PasswordResetToken{}).
		Where("user_id = ? AND used = ?", userID, false).
		Update("used", true)

	token, err := generateSecureToken()
	if err != nil {
		return nil, xerrors.Errorf("CreatePasswordResetToken: %w", err)
	}

	t := &PasswordResetToken{
		Token:     token,
		UserID:    userID,
		ExpiresAt: time.Now().Add(duration),
	}
	if res := db.Create(t); res.Error != nil {
		return nil, xerrors.Errorf("CreatePasswordResetToken save: %w", res.Error)
	}
	return t, nil
}

// GetPasswordResetToken はトークンを検索して返す。有効期限切れ・使用済みは nil を返す。
func GetPasswordResetToken(token string) (*PasswordResetToken, error) {
	var t PasswordResetToken
	res := db.First(&t, "token = ?", token)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetPasswordResetToken: %w", res.Error)
	}
	if t.Used || time.Now().After(t.ExpiresAt) {
		return nil, nil
	}
	return &t, nil
}

// MarkTokenUsed はトークンを使用済みにする。
func MarkTokenUsed(token string) error {
	if res := db.Model(&PasswordResetToken{}).Where("token = ?", token).Update("used", true); res.Error != nil {
		return xerrors.Errorf("MarkTokenUsed: %w", res.Error)
	}
	return nil
}

// ── Session ──────────────────────────────────────────────

// Session はログインセッション。
type Session struct {
	ID        string     `gorm:"primaryKey" json:"id"`
	UserID    string     `json:"user_id"`
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt *time.Time `gorm:"autoCreateTime" json:"created_at"`
}

// CreateSession はセッションを作成する。
func CreateSession(userID string, duration time.Duration) (*Session, error) {
	token, err := generateSecureToken()
	if err != nil {
		return nil, xerrors.Errorf("CreateSession: %w", err)
	}
	s := &Session{
		ID:        token,
		UserID:    userID,
		ExpiresAt: time.Now().Add(duration),
	}
	if res := db.Create(s); res.Error != nil {
		return nil, xerrors.Errorf("CreateSession save: %w", res.Error)
	}
	return s, nil
}

// GetSession はセッションを検索する。有効期限切れは nil を返して自動削除する。
func GetSession(id string) (*Session, error) {
	var s Session
	res := db.First(&s, "id = ?", id)
	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if res.Error != nil {
		return nil, xerrors.Errorf("GetSession: %w", res.Error)
	}
	if time.Now().After(s.ExpiresAt) {
		db.Delete(&Session{}, "id = ?", id)
		return nil, nil
	}
	return &s, nil
}

// DeleteSession はセッションを削除する。
func DeleteSession(id string) error {
	if res := db.Delete(&Session{}, "id = ?", id); res.Error != nil {
		return xerrors.Errorf("DeleteSession: %w", res.Error)
	}
	return nil
}

// DeleteSessionsByUser はユーザの全セッションを削除する。
func DeleteSessionsByUser(userID string) error {
	if res := db.Where("user_id = ?", userID).Delete(&Session{}); res.Error != nil {
		return xerrors.Errorf("DeleteSessionsByUser: %w", res.Error)
	}
	return nil
}

// CleanExpiredSessions は有効期限切れのセッションとトークンを削除する。
func CleanExpiredSessions() {
	now := time.Now()
	db.Where("expires_at < ?", now).Delete(&Session{})
	db.Where("expires_at < ? OR used = ?", now, true).Delete(&PasswordResetToken{})
}

// ── シードデータ ──────────────────────────────────────────

// SeedAuthData はシステムユーザ・グループを初期投入する。
// 既に存在する場合はスキップする。
func SeedAuthData() error {
	// BrenderOwner ユーザ
	var ownerCount int64
	db.Model(&User{}).Where("id = ?", UserIDOwner).Count(&ownerCount)
	if ownerCount == 0 {
		owner := &User{ID: UserIDOwner, Name: "BrenderOwner", DisplayName: "Brender Owner", IsSystem: true}
		if res := db.Create(owner); res.Error != nil {
			return xerrors.Errorf("seed owner: %w", res.Error)
		}
	}

	// Guest ユーザ
	var guestCount int64
	db.Model(&User{}).Where("id = ?", UserIDGuest).Count(&guestCount)
	if guestCount == 0 {
		guest := &User{ID: UserIDGuest, Name: "Guest", DisplayName: "Guest", IsSystem: true}
		if res := db.Create(guest); res.Error != nil {
			return xerrors.Errorf("seed guest: %w", res.Error)
		}
	}

	// All グループ
	var allCount int64
	db.Model(&Group{}).Where("id = ?", GroupIDAll).Count(&allCount)
	if allCount == 0 {
		all := &Group{ID: GroupIDAll, DisplayName: "All Users", IsSystem: true}
		if res := db.Create(all); res.Error != nil {
			return xerrors.Errorf("seed all group: %w", res.Error)
		}
	}

	return nil
}
