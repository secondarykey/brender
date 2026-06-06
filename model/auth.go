package model

import (
	"crypto/rand"
	"errors"
	"math/big"

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
	GroupIDAll   = "grp_all"
)

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
	ID          string `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"uniqueIndex" json:"name"` // ログインID（ASCII限定）
	DisplayName string `json:"display_name"`             // 表示名
	IsSystem    bool   `gorm:"default:false" json:"is_system"`
	MetaFields  `gorm:"embedded"`
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

func CreateUser(name, displayName string) (*User, error) {
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
	}
	if res := db.Create(u); res.Error != nil {
		return nil, xerrors.Errorf("CreateUser: %w", res.Error)
	}
	return u, nil
}

func UpdateUser(id, name, displayName string) (*User, error) {
	var u User
	if res := db.First(&u, "id = ?", id); res.Error != nil {
		return nil, xerrors.Errorf("UpdateUser find: %w", res.Error)
	}
	if u.IsSystem {
		// システムユーザは表示名のみ変更可
		u.DisplayName = displayName
	} else {
		if !isASCII(name) {
			return nil, xerrors.New("login ID must be ASCII characters only")
		}
		u.Name = name
		u.DisplayName = displayName
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
