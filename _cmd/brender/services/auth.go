package services

import (
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
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

func (s *Auth) CreateUser(name, displayName, role string) (*model.User, error) {
	return api.CreateUser(api.WailsContext(), name, displayName, role)
}

func (s *Auth) UpdateUser(id, name, displayName, role string) (*model.User, error) {
	return api.UpdateUser(api.WailsContext(), id, name, displayName, role)
}

func (s *Auth) DeleteUser(id string) error {
	return api.DeleteUser(api.WailsContext(), id)
}

// ── Group ─────────────────────────────────────────────────

func (s *Auth) ListGroups() ([]*model.Group, error) {
	return api.ListGroups()
}

func (s *Auth) GetGroup(id string) (*model.Group, error) {
	return api.GetGroup(id)
}

func (s *Auth) CreateGroup(displayName string) (*model.Group, error) {
	return api.CreateGroup(api.WailsContext(), displayName)
}

func (s *Auth) UpdateGroup(id, displayName string) (*model.Group, error) {
	return api.UpdateGroup(api.WailsContext(), id, displayName)
}

func (s *Auth) DeleteGroup(id string) error {
	return api.DeleteGroup(api.WailsContext(), id)
}

// ── UserGroup ─────────────────────────────────────────────

func (s *Auth) ListGroupsByUser(userID string) ([]*model.Group, error) {
	return api.ListGroupsByUser(userID)
}

func (s *Auth) ListUsersByGroup(groupID string) ([]*model.User, error) {
	return api.ListUsersByGroup(groupID)
}

func (s *Auth) AddUserToGroup(userID, groupID string) error {
	return api.AddUserToGroup(api.WailsContext(), userID, groupID)
}

func (s *Auth) RemoveUserFromGroup(userID, groupID string) error {
	return api.RemoveUserFromGroup(api.WailsContext(), userID, groupID)
}

// ── Password / Login ─────────────────────────────────────

func (s *Auth) ListUsersWithStatus() ([]*api.UserWithStatus, error) {
	return api.ListUsersWithStatus(api.WailsContext())
}

func (s *Auth) GetActiveResetToken(userID string) (*api.ResetTokenInfo, error) {
	return api.GetActiveResetToken(api.WailsContext(), userID)
}

func (s *Auth) GenerateResetToken(userID string) (string, error) {
	return api.GenerateResetToken(api.WailsContext(), userID)
}
