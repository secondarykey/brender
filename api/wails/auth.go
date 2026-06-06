package wails

import (
	"github.com/ikascrew/brender/api"
	"github.com/ikascrew/brender/model"
)

type Auth struct{}

func NewAuth() *Auth {
	return &Auth{}
}

// ── User ──────────────────────────────────────────────────

func (s *Auth) ListUsers() ([]*model.User, error) {
	return api.ListUsers()
}

func (s *Auth) GetUser(id string) (*model.User, error) {
	return api.GetUser(id)
}

func (s *Auth) CreateUser(name, displayName string) (*model.User, error) {
	return api.CreateUser(name, displayName)
}

func (s *Auth) UpdateUser(id, name, displayName string) (*model.User, error) {
	return api.UpdateUser(id, name, displayName)
}

func (s *Auth) DeleteUser(id string) error {
	return api.DeleteUser(id)
}

// ── Group ─────────────────────────────────────────────────

func (s *Auth) ListGroups() ([]*model.Group, error) {
	return api.ListGroups()
}

func (s *Auth) GetGroup(id string) (*model.Group, error) {
	return api.GetGroup(id)
}

func (s *Auth) CreateGroup(name, displayName string) (*model.Group, error) {
	return api.CreateGroup(name, displayName)
}

func (s *Auth) UpdateGroup(id, name, displayName string) (*model.Group, error) {
	return api.UpdateGroup(id, name, displayName)
}

func (s *Auth) DeleteGroup(id string) error {
	return api.DeleteGroup(id)
}

// ── UserGroup ─────────────────────────────────────────────

func (s *Auth) ListGroupsByUser(userID string) ([]*model.Group, error) {
	return api.ListGroupsByUser(userID)
}

func (s *Auth) ListUsersByGroup(groupID string) ([]*model.User, error) {
	return api.ListUsersByGroup(groupID)
}

func (s *Auth) AddUserToGroup(userID, groupID string) error {
	return api.AddUserToGroup(userID, groupID)
}

func (s *Auth) RemoveUserFromGroup(userID, groupID string) error {
	return api.RemoveUserFromGroup(userID, groupID)
}
