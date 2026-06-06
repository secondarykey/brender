package api

import (
	"github.com/ikascrew/brender/model"
	"golang.org/x/xerrors"
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

func CreateGroup(name, displayName string) (*model.Group, error) {
	if name == "" {
		return nil, xerrors.New("group name is required")
	}
	if displayName == "" {
		displayName = name
	}
	return model.CreateGroup(name, displayName)
}

func UpdateGroup(id, name, displayName string) (*model.Group, error) {
	if name == "" {
		return nil, xerrors.New("group name is required")
	}
	return model.UpdateGroup(id, name, displayName)
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
