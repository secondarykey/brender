package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/secondarykey/brender/api"
	"github.com/secondarykey/brender/code"
)

type Codes struct{}

func NewCodes() *Codes { return &Codes{} }

func (s *Codes) GetImageFormats(ctx context.Context) ([]code.ImageFormat, error) {
	return code.GetImageFormats()
}

func (s *Codes) GetVideoFormats(ctx context.Context) ([]code.VideoFormat, error) {
	return code.GetVideoFormats()
}

func (s *Codes) GetResolutionPresets(ctx context.Context) ([]code.ResolutionPreset, error) {
	return code.GetResolutionPresets()
}

func (s *Codes) SaveImageFormats(ctx context.Context, items []code.ImageFormat) error {
	return api.SaveImageFormats(ctx, items)
}

func (s *Codes) SaveVideoFormats(ctx context.Context, items []code.VideoFormat) error {
	return api.SaveVideoFormats(ctx, items)
}

func (s *Codes) SaveResolutionPresets(ctx context.Context, items []code.ResolutionPreset) error {
	return api.SaveResolutionPresets(ctx, items)
}

func (s *Codes) GenerateID(ctx context.Context) (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

func (s *Codes) ResetImageFormats(ctx context.Context) error { return api.ResetImageFormats(ctx) }
func (s *Codes) ResetVideoFormats(ctx context.Context) error { return api.ResetVideoFormats(ctx) }
func (s *Codes) ResetResolutionPresets(ctx context.Context) error {
	return api.ResetResolutionPresets(ctx)
}
