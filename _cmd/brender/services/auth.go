package services

import (
	"context"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/model"
)

type Auth struct{}

func NewAuth() *Auth {
	return &Auth{}
}

// ── User ──────────────────────────────────────────────────

func (s *Auth) ListUsers(ctx context.Context) ([]*model.User, error) {
	return api.ListUsers()
}

func (s *Auth) GetUser(ctx context.Context, id string) (*model.User, error) {
	return api.GetUser(id)
}

func (s *Auth) CreateUser(ctx context.Context, name, displayName, role string) (*model.User, error) {
	return api.CreateUser(ctx, name, displayName, role)
}

func (s *Auth) UpdateUser(ctx context.Context, id, name, displayName, role string) (*model.User, error) {
	return api.UpdateUser(ctx, id, name, displayName, role)
}

func (s *Auth) DeleteUser(ctx context.Context, id string) error {
	return api.DeleteUser(ctx, id)
}

// ── Group ─────────────────────────────────────────────────

func (s *Auth) ListGroups(ctx context.Context) ([]*model.Group, error) {
	return api.ListGroups()
}

func (s *Auth) GetGroup(ctx context.Context, id string) (*model.Group, error) {
	return api.GetGroup(id)
}

func (s *Auth) CreateGroup(ctx context.Context, displayName string) (*model.Group, error) {
	return api.CreateGroup(ctx, displayName)
}

func (s *Auth) UpdateGroup(ctx context.Context, id, displayName string) (*model.Group, error) {
	return api.UpdateGroup(ctx, id, displayName)
}

func (s *Auth) DeleteGroup(ctx context.Context, id string) error {
	return api.DeleteGroup(ctx, id)
}

// ── UserGroup ─────────────────────────────────────────────

func (s *Auth) ListGroupsByUser(ctx context.Context, userID string) ([]*model.Group, error) {
	return api.ListGroupsByUser(userID)
}

func (s *Auth) ListUsersByGroup(ctx context.Context, groupID string) ([]*model.User, error) {
	return api.ListUsersByGroup(groupID)
}

func (s *Auth) AddUserToGroup(ctx context.Context, userID, groupID string) error {
	return api.AddUserToGroup(ctx, userID, groupID)
}

func (s *Auth) RemoveUserFromGroup(ctx context.Context, userID, groupID string) error {
	return api.RemoveUserFromGroup(ctx, userID, groupID)
}

// ── Password / Login ─────────────────────────────────────

func (s *Auth) ListUsersWithStatus(ctx context.Context) ([]*api.UserWithStatus, error) {
	return api.ListUsersWithStatus(ctx)
}

func (s *Auth) GetActiveResetToken(ctx context.Context, userID string) (*api.ResetTokenInfo, error) {
	return api.GetActiveResetToken(ctx, userID)
}

func (s *Auth) GenerateResetToken(ctx context.Context, userID string) (string, error) {
	return api.GenerateResetToken(ctx, userID)
}
